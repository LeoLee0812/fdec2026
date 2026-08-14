/**
 * FDEC 2026 选座系统 · Cloudflare Worker
 * 同一个 Worker 承担两件事：/api/* 走 Hono 路由，其余请求交给静态资源（SPA）
 */
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database
  ASSETS: Fetcher
  AUTH_SECRET: string
  PHONE_SALT: string
  TURNSTILE_SECRET?: string
  TURNSTILE_SITEKEY?: string
  EVENT_NAME: string
}

type Vars = { me: Attendee }

type Attendee = {
  id: number
  name: string
  source: string
}

const COOKIE = 'fdec_token'
const TOKEN_TTL = 60 * 60 * 24 * 14 // 两周，覆盖整个活动周期

const app = new Hono<{ Bindings: Bindings; Variables: Vars }>()

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

function clientIp(c: { req: { header: (k: string) => string | undefined } }) {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
}

async function log(db: D1Database, attendeeId: number | null, action: string, detail: string, ip: string) {
  await db
    .prepare('INSERT INTO audit_log (at, attendee_id, action, detail, ip) VALUES (?,?,?,?,?)')
    .bind(Date.now(), attendeeId, action, detail, ip)
    .run()
}

async function getConfig(db: D1Database) {
  const { results } = await db.prepare('SELECT key, value FROM config').all<{ key: string; value: string }>()
  return Object.fromEntries(results.map((r) => [r.key, r.value])) as Record<string, string>
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
async function loginThrottled(db: D1Database, ip: string) {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE ip = ? AND action = 'login_fail' AND at > ?")
    .bind(ip, Date.now() - 60_000)
    .first<{ n: number }>()
  return (row?.n ?? 0) >= 8
}

/* ---------------- 中间件 ---------------- */

async function auth(c: any, next: () => Promise<void>) {
  const claims = await verifyToken(c.env.AUTH_SECRET, getCookie(c, COOKIE))
  if (!claims) return c.json({ error: '登录已过期，请重新进入' }, 401)
  const me = await c.env.DB.prepare('SELECT id, name, source FROM attendees WHERE id = ?')
    .bind(claims.id)
    .first<Attendee>()
  if (!me) return c.json({ error: '账号不存在' }, 401)
  c.set('me', me)
  await next()
}

/* ---------------- 路由 ---------------- */

app.post('/api/login', async (c) => {
  const ip = clientIp(c)
  const body = await c.req.json<{ name?: string; phone?: string; invite_code?: string; turnstile?: string; hp?: string }>()

  // 蜜罐字段：正常用户看不见这个输入框，填了就是脚本
  if (body.hp) return c.json({ error: '提交异常，请刷新页面重试' }, 400)

  const name = String(body.name || '').trim().slice(0, 20)
  const phone = normalizePhone(body.phone || '')
  const code = String(body.invite_code || '').trim().toUpperCase().slice(0, 24)

  if (!name) return c.json({ error: '请填写姓名' }, 400)
  if (phone.length < 6) return c.json({ error: '请填写正确的手机号' }, 400)

  if (await loginThrottled(c.env.DB, ip)) {
    return c.json({ error: '尝试过于频繁，请稍后再试' }, 429)
  }
  if (!(await verifyTurnstile(c.env.TURNSTILE_SECRET, body.turnstile, ip))) {
    return c.json({ error: '人机校验未通过，请刷新页面重试' }, 403)
  }

  const hash = await phoneHash(c.env.PHONE_SALT, phone)
  const cfg = await getConfig(c.env.DB)

  let me = await c.env.DB.prepare('SELECT id, name, source FROM attendees WHERE phone_hash = ?')
    .bind(hash)
    .first<Attendee>()

  if (!me) {
    // 不在报名白名单里 —— 走邀请码通道
    if (cfg.allow_selfserve !== '1') {
      await log(c.env.DB, null, 'login_fail', `not_in_list:${name}`, ip)
      return c.json({ error: '未在报名名单中，请联系工作人员' }, 403)
    }
    if (!code) {
      await log(c.env.DB, null, 'login_fail', `need_code:${name}`, ip)
      return c.json({ error: '这个手机号不在报名名单里，请填写邀请码' }, 403)
    }
    const invite = await c.env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?')
      .bind(code)
      .first<{ code: string; kind: string; quota: number; used: number; expires_at: number | null; active: number }>()

    const nowSec = Math.floor(Date.now() / 1000)
    const bad =
      !invite ||
      invite.active !== 1 ||
      invite.used >= invite.quota ||
      (invite.expires_at !== null && invite.expires_at < nowSec)

    if (bad) {
      await log(c.env.DB, null, 'login_fail', `bad_code:${code}`, ip)
      return c.json({ error: '邀请码无效或已被使用' }, 403)
    }

    const res = await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO attendees (name, phone_hash, phone_tail, source, invite_code, created_at) VALUES (?,?,?,?,?,?)',
      ).bind(name, hash, phone.slice(-4), 'invite', code, Date.now()),
      c.env.DB.prepare('UPDATE invite_codes SET used = used + 1 WHERE code = ?').bind(code),
    ])
    const newId = (res[0].meta as { last_row_id: number }).last_row_id
    me = { id: newId, name, source: 'invite' }
    await log(c.env.DB, newId, 'login_new', `code:${code}`, ip)
  } else {
    // 白名单用户：姓名对不上直接拒（防止拿到别人手机号冒名顶替）
    if (me.name !== name) {
      await log(c.env.DB, me.id, 'login_fail', `name_mismatch:${name}`, ip)
      return c.json({ error: '姓名与报名信息不一致，请核对后重试' }, 403)
    }
    await log(c.env.DB, me.id, 'login', '', ip)
  }

  const token = await issueToken(c.env.AUTH_SECRET, { id: me.id })
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
  return c.json(await buildState(c.env.DB, c.get('me')))
})

app.post('/api/select', auth, async (c) => {
  const me = c.get('me')
  const ip = clientIp(c)
  const { topic_id, seat_no } = await c.req.json<{ topic_id: number; seat_no: number }>()
  const cfg = await getConfig(c.env.DB)
  if (cfg.open !== '1') return c.json({ error: '选座已锁定' }, 403)

  const topic = await c.env.DB.prepare('SELECT id, capacity FROM topics WHERE id = ?')
    .bind(topic_id)
    .first<{ id: number; capacity: number }>()
  if (!topic) return c.json({ error: '话题不存在' }, 404)
  if (!Number.isInteger(seat_no) || seat_no < 0 || seat_no >= topic.capacity) {
    return c.json({ error: '座位号不合法' }, 400)
  }

  try {
    // 先释放旧座再占新座，两条语句放同一批，避免中途失败留下两个座位
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM seats WHERE attendee_id = ?').bind(me.id),
      c.env.DB.prepare('INSERT INTO seats (topic_id, seat_no, attendee_id, created_at) VALUES (?,?,?,?)').bind(
        topic_id,
        seat_no,
        me.id,
        Date.now(),
      ),
    ])
  } catch {
    // 主键冲突 = 这一瞬间被别人抢先坐下了
    return c.json({ error: '手慢了，这个位置刚被别人选走' }, 409)
  }
  await log(c.env.DB, me.id, 'select', `${topic_id}#${seat_no}`, ip)
  return c.json(await buildState(c.env.DB, me))
})

app.post('/api/unselect', auth, async (c) => {
  const me = c.get('me')
  const cfg = await getConfig(c.env.DB)
  if (cfg.open !== '1') return c.json({ error: '选座已锁定' }, 403)
  await c.env.DB.prepare('DELETE FROM seats WHERE attendee_id = ?').bind(me.id).run()
  await log(c.env.DB, me.id, 'unselect', '', clientIp(c))
  return c.json(await buildState(c.env.DB, me))
})

async function buildState(db: D1Database, me: Attendee) {
  const cfg = await getConfig(db)
  const [topicsRes, seatsRes] = await db.batch<any>([
    db.prepare('SELECT id, table_no, title, description, owner_name, capacity, accent FROM topics ORDER BY table_no'),
    db.prepare(
      'SELECT s.topic_id, s.seat_no, s.attendee_id, a.name FROM seats s JOIN attendees a ON a.id = s.attendee_id',
    ),
  ])

  const seats = seatsRes.results as { topic_id: number; seat_no: number; attendee_id: number; name: string }[]
  const byTopic = new Map<number, typeof seats>()
  for (const s of seats) {
    if (!byTopic.has(s.topic_id)) byTopic.set(s.topic_id, [])
    byTopic.get(s.topic_id)!.push(s)
  }

  const topics = (topicsRes.results as any[]).map((t) => ({
    id: t.id,
    table_no: t.table_no,
    title: t.title,
    description: t.description,
    owner_name: t.owner_name,
    capacity: t.capacity,
    accent: t.accent,
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

app.get('/api/config', (c) =>
  c.json({ event: c.env.EVENT_NAME, turnstileSiteKey: c.env.TURNSTILE_SITEKEY || '' }),
)

app.all('/api/*', (c) => c.json({ error: '接口不存在' }, 404))

export default app
