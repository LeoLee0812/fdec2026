/**
 * FDEC 2026 选座系统 · 业务路由（与运行平台无关）
 *
 * 这里只依赖 shared/db.ts 里的 Db 接口，因此同一份逻辑可以：
 * - 在 Cloudflare Worker 里配 D1 适配器跑（worker/index.ts）
 * - 在 Vercel Function 里配 Neon 适配器跑（api/[[...route]].ts）
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Cfg, Db } from './db.js'

type Vars = { me: Attendee; db: Db; cfg: Cfg }

type Attendee = {
  id: number
  name: string
  source: string
}

const COOKIE = 'fdec_token'
const TOKEN_TTL = 60 * 60 * 24 * 14 // 两周，覆盖整个活动周期

/* ---------------- 基础工具 ---------------- */

const enc = new TextEncoder()

async function hmacHex(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function b64url(s: string) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function unb64url(s: string) {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  return decodeURIComponent(escape(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))))
}

/** 极简 HMAC token：payload.signature，避免为了 JWT 引一整个库 */
async function issueToken(secret: string, payload: object) {
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL }))
  return `${body}.${await hmacHex(secret, body)}`
}

async function verifyToken(secret: string, token?: string): Promise<{ id: number } | null> {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if ((await hmacHex(secret, body)) !== sig) return null
  try {
    const data = JSON.parse(unb64url(body))
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
    return { id: data.id }
  } catch {
    return null
  }
}

/** 手机号只以摘要形式落库，导入脚本用同一套算法 */
async function phoneHash(salt: string, phone: string) {
  return hmacHex(salt, `phone:${phone.replace(/\D/g, '')}`)
}

function normalizePhone(raw: string) {
  return String(raw || '').replace(/\D/g, '')
}

function clientIp(c: Context) {
  // CF-Connecting-IP 是 Cloudflare 的，X-Forwarded-For 首段是 Vercel 的
  return (
    c.req.header('CF-Connecting-IP') ||
    (c.req.header('X-Forwarded-For') || '').split(',')[0].trim() ||
    'unknown'
  )
}

async function log(db: Db, attendeeId: number | null, action: string, detail: string, ip: string) {
  await db.run('INSERT INTO audit_log ("at", attendee_id, action, detail, ip) VALUES (?,?,?,?,?)', [
    Date.now(),
    attendeeId,
    action,
    detail,
    ip,
  ])
}

async function getConfig(db: Db) {
  const rows = await db.all<{ key: string; value: string }>('SELECT "key", "value" FROM config')
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>
}

/* ---------------- 防爬 / 防刷 ---------------- */

/** Turnstile 人机校验：未配置密钥时自动跳过，方便本地开发 */
async function verifyTurnstile(secret: string | undefined, token: string | undefined, ip: string) {
  if (!secret) return true
  if (!token) return false
  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  form.append('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  })
  const data = (await res.json()) as { success?: boolean }
  return !!data.success
}

/** 同一 IP 一分钟内登录失败超过 8 次就先冷却，挡掉手机号字典撞库 */
async function loginThrottled(db: Db, ip: string) {
  const row = await db.first<{ n: number | string }>(
    'SELECT COUNT(*) AS n FROM audit_log WHERE ip = ? AND action = \'login_fail\' AND "at" > ?',
    [ip, Date.now() - 60_000],
  )
  // Postgres 的 COUNT(*) 走 bigint，驱动会回字符串，这里统一成数字
  return Number(row?.n ?? 0) >= 8
}

/* ---------------- 应用工厂 ---------------- */

/** resolve 负责在每个请求里给出这次要用的数据库连接和环境配置 */
export function createApp(resolve: (c: Context) => { db: Db; cfg: Cfg }) {
  const app = new Hono<{ Variables: Vars }>()

  app.use('*', async (c, next) => {
    const { db, cfg } = resolve(c)
    c.set('db', db)
    c.set('cfg', cfg)
    await next()
  })

  async function auth(c: Context<{ Variables: Vars }>, next: () => Promise<void>) {
    const db = c.get('db')
    const claims = await verifyToken(c.get('cfg').AUTH_SECRET, getCookie(c, COOKIE))
    if (!claims) return c.json({ error: '登录已过期，请重新进入' }, 401)
    const me = await db.first<Attendee>('SELECT id, name, source FROM attendees WHERE id = ?', [claims.id])
    if (!me) return c.json({ error: '账号不存在' }, 401)
    c.set('me', me)
    await next()
  }

  app.post('/api/login', async (c) => {
    const db = c.get('db')
    const env = c.get('cfg')
    const ip = clientIp(c)
    const body = await c.req.json<{
      name?: string
      phone?: string
      invite_code?: string
      turnstile?: string
      hp?: string
    }>()

    // 蜜罐字段：正常用户看不见这个输入框，填了就是脚本
    if (body.hp) return c.json({ error: '提交异常，请刷新页面重试' }, 400)

    const name = String(body.name || '').trim().slice(0, 20)
    const phone = normalizePhone(body.phone || '')
    const code = String(body.invite_code || '').trim().toUpperCase().slice(0, 24)

    // 姓名不再是登录凭据（报名时留的未必是真名），只有走邀请码新建记录时才需要它
    if (phone.length < 6) return c.json({ error: '请填写正确的手机号' }, 400)

    if (await loginThrottled(db, ip)) {
      return c.json({ error: '尝试过于频繁，请稍后再试' }, 429)
    }
    if (!(await verifyTurnstile(env.TURNSTILE_SECRET, body.turnstile, ip))) {
      return c.json({ error: '人机校验未通过，请刷新页面重试' }, 403)
    }

    const hash = await phoneHash(env.PHONE_SALT, phone)
    const cfg = await getConfig(db)

    let me = await db.first<Attendee>('SELECT id, name, source FROM attendees WHERE phone_hash = ?', [hash])

    if (!me) {
      // 不在报名白名单里 —— 走邀请码通道
      if (cfg.allow_selfserve !== '1') {
        await log(db, null, 'login_fail', `not_in_list:${name}`, ip)
        return c.json({ error: '未在报名名单中，请联系工作人员' }, 403)
      }
      if (!code) {
        await log(db, null, 'login_fail', `need_code:${name}`, ip)
        return c.json({ error: '这个手机号不在报名名单里，请填写邀请码' }, 403)
      }
      // 临时来宾库里没有记录，得留个名字，否则座位上显示不出是谁
      if (!name) return c.json({ error: '请填写姓名，方便同桌认识你' }, 400)
      const invite = await db.first<{
        code: string
        kind: string
        quota: number
        used: number
        expires_at: number | null
        active: number
      }>('SELECT * FROM invite_codes WHERE code = ?', [code])

      const nowSec = Math.floor(Date.now() / 1000)
      const bad =
        !invite ||
        Number(invite.active) !== 1 ||
        Number(invite.used) >= Number(invite.quota) ||
        (invite.expires_at !== null && Number(invite.expires_at) < nowSec)

      if (bad) {
        await log(db, null, 'login_fail', `bad_code:${code}`, ip)
        return c.json({ error: '邀请码无效或已被使用' }, 403)
      }

      const res = await db.tx<{ id: number }>([
        {
          sql: 'INSERT INTO attendees (name, phone_hash, phone_tail, source, invite_code, created_at) VALUES (?,?,?,?,?,?) RETURNING id',
          params: [name, hash, phone.slice(-4), 'invite', code, Date.now()],
        },
        { sql: 'UPDATE invite_codes SET used = used + 1 WHERE code = ?', params: [code] },
      ])
      const newId = Number(res[0]?.[0]?.id)
      me = { id: newId, name, source: 'invite' }
      await log(db, newId, 'login_new', `code:${code}`, ip)
    } else {
      // 白名单用户：手机号命中即放行，姓名一律以报名表里的为准
      await log(db, me.id, 'login', '', ip)
    }

    const token = await issueToken(env.AUTH_SECRET, { id: me.id })
    setCookie(c, COOKIE, token, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Lax',
      path: '/',
      maxAge: TOKEN_TTL,
    })
    return c.json({ name: me.name })
  })

  app.post('/api/logout', (c) => {
    deleteCookie(c, COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  /** 全场状态：必须登录才能拿到，未登录一个字段都不给 */
  app.get('/api/state', auth, async (c) => {
    return c.json(await buildState(c.get('db'), c.get('me')))
  })

  app.post('/api/select', auth, async (c) => {
    const db = c.get('db')
    const me = c.get('me')
    const ip = clientIp(c)
    const { topic_id, seat_no } = await c.req.json<{ topic_id: number; seat_no: number }>()
    const cfg = await getConfig(db)
    if (cfg.open !== '1') return c.json({ error: '选座已锁定' }, 403)

    const topic = await db.first<{ id: number; capacity: number; locked: number }>(
      'SELECT id, capacity, locked FROM topics WHERE id = ?',
      [topic_id],
    )
    if (!topic) return c.json({ error: '话题不存在' }, 404)
    // 嘉宾桌等锁定的桌子不开放选座，前端会拦一道，这里再兜一道
    if (Number(topic.locked) === 1) return c.json({ error: '当前桌无法选择' }, 403)
    if (!Number.isInteger(seat_no) || seat_no < 0 || seat_no >= Number(topic.capacity)) {
      return c.json({ error: '座位号不合法' }, 400)
    }

    try {
      // 先释放旧座再占新座，两条语句放同一个事务，避免中途失败留下两个座位
      await db.tx([
        { sql: 'DELETE FROM seats WHERE attendee_id = ?', params: [me.id] },
        {
          sql: 'INSERT INTO seats (topic_id, seat_no, attendee_id, created_at) VALUES (?,?,?,?)',
          params: [topic_id, seat_no, me.id, Date.now()],
        },
      ])
    } catch {
      // 主键冲突 = 这一瞬间被别人抢先坐下了
      return c.json({ error: '手慢了，这个位置刚被别人选走' }, 409)
    }
    await log(db, me.id, 'select', `${topic_id}#${seat_no}`, ip)
    return c.json(await buildState(db, me))
  })

  app.post('/api/unselect', auth, async (c) => {
    const db = c.get('db')
    const me = c.get('me')
    const cfg = await getConfig(db)
    if (cfg.open !== '1') return c.json({ error: '选座已锁定' }, 403)
    await db.run('DELETE FROM seats WHERE attendee_id = ?', [me.id])
    await log(db, me.id, 'unselect', '', clientIp(c))
    return c.json(await buildState(db, me))
  })

  app.get('/api/config', (c) =>
    c.json({ event: c.get('cfg').EVENT_NAME, turnstileSiteKey: c.get('cfg').TURNSTILE_SITEKEY || '' }),
  )

  app.all('/api/*', (c) => c.json({ error: '接口不存在' }, 404))

  return app
}

async function buildState(db: Db, me: Attendee) {
  const cfg = await getConfig(db)
  const [topicsRows, seatsRows] = await db.tx<any>([
    { sql: 'SELECT id, table_no, title, owner_name, capacity, accent, locked FROM topics ORDER BY table_no' },
    {
      sql: 'SELECT s.topic_id, s.seat_no, s.attendee_id, a.name FROM seats s JOIN attendees a ON a.id = s.attendee_id',
    },
  ])

  const seats = seatsRows as { topic_id: number; seat_no: number; attendee_id: number; name: string }[]
  const byTopic = new Map<number, typeof seats>()
  for (const s of seats) {
    if (!byTopic.has(s.topic_id)) byTopic.set(s.topic_id, [])
    byTopic.get(s.topic_id)!.push(s)
  }

  const topics = (topicsRows as any[]).map((t) => ({
    id: t.id,
    table_no: t.table_no,
    title: t.title,
    owner_name: t.owner_name,
    capacity: t.capacity,
    accent: t.accent,
    locked: Number(t.locked) === 1,
    taken: (byTopic.get(t.id) || []).map((s) => ({
      seat_no: s.seat_no,
      name: s.name,
      mine: s.attendee_id === me.id,
    })),
  }))

  const mine = seats.find((s) => s.attendee_id === me.id)
  const mySeat = mine
    ? {
        topic_id: mine.topic_id,
        seat_no: mine.seat_no,
        title: topics.find((t) => t.id === mine.topic_id)?.title ?? '',
        table_no: topics.find((t) => t.id === mine.topic_id)?.table_no ?? 0,
      }
    : null

  return { open: cfg.open === '1', notice: cfg.notice || '', me: { name: me.name }, topics, mySeat }
}
