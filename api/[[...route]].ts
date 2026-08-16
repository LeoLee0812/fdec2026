/**
 * FDEC 2026 选座系统 · Vercel Function 入口
 *
 * 业务逻辑全在 shared/routes.ts，这里只做两件事：
 * 1. 把 Neon（Postgres）包装成 shared/db.ts 里的 Db 接口
 * 2. 从 process.env 取环境配置
 *
 * 文件名是 catch-all，/api/ 下的所有路径都进这个函数，再交给 Hono 分发。
 */
import { neon } from '@neondatabase/serverless'
import { handle } from 'hono/vercel'
import type { Cfg, Db, Row, Stmt } from '../shared/db.js'
import { createApp } from '../shared/routes.js'

export const config = { runtime: 'nodejs' }

/** 共享 SQL 用的是 `?`，Postgres 要 $1/$2，这里按出现顺序换掉 */
function toPg(sql: string) {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

let cached: ReturnType<typeof neon> | null = null
function client() {
  if (!cached) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('缺少 DATABASE_URL（Neon 集成会自动注入，本地开发用 vercel env pull）')
    cached = neon(url)
  }
  return cached
}

function neonAdapter(): Db {
  const sql = client()
  return {
    async all<T = Row>(text: string, params: unknown[] = []) {
      return (await sql.query(toPg(text), params as any[])) as T[]
    },
    async first<T = Row>(text: string, params: unknown[] = []) {
      const rows = (await sql.query(toPg(text), params as any[])) as T[]
      return rows[0] ?? null
    },
    async run(text: string, params: unknown[] = []) {
      await sql.query(toPg(text), params as any[])
    },
    async tx<T = Row>(stmts: Stmt[]) {
      const res = await sql.transaction(stmts.map((s) => sql.query(toPg(s.sql), (s.params ?? []) as any[])))
      return res as T[][]
    },
  }
}

const app = createApp(() => ({
  db: neonAdapter(),
  cfg: {
    AUTH_SECRET: process.env.AUTH_SECRET ?? '',
    PHONE_SALT: process.env.PHONE_SALT ?? '',
    TURNSTILE_SECRET: process.env.TURNSTILE_SECRET,
    TURNSTILE_SITEKEY: process.env.TURNSTILE_SITEKEY,
    EVENT_NAME: process.env.EVENT_NAME ?? 'FDEC 2026 前沿部署工程师大会',
  } satisfies Cfg,
}))

export default handle(app)
