/**
 * FDEC 2026 选座系统 · Cloudflare Worker 入口
 *
 * 业务逻辑全在 shared/routes.ts，这里只做两件事：
 * 1. 把 D1 包装成 shared/db.ts 里的 Db 接口
 * 2. 从 Worker 的 env 里取出环境配置
 *
 * 静态资源由 wrangler.jsonc 的 assets 配置直接处理，只有 /api/* 会进到这里。
 */
import type { Cfg, Db, Row, Stmt } from '../shared/db'
import { createApp } from '../shared/routes'

type Bindings = {
  DB: D1Database
  ASSETS: Fetcher
  AUTH_SECRET: string
  PHONE_SALT: string
  TURNSTILE_SECRET?: string
  TURNSTILE_SITEKEY?: string
  EVENT_NAME: string
}

/** D1 本身就是 SQLite + `?` 占位符，直接透传即可 */
function d1Adapter(db: D1Database): Db {
  const bind = (s: Stmt) => db.prepare(s.sql).bind(...(s.params ?? []))
  return {
    async all<T = Row>(sql: string, params: unknown[] = []) {
      const { results } = await db.prepare(sql).bind(...params).all<T>()
      return results ?? []
    },
    async first<T = Row>(sql: string, params: unknown[] = []) {
      return (await db.prepare(sql).bind(...params).first<T>()) ?? null
    },
    async run(sql: string, params: unknown[] = []) {
      await db.prepare(sql).bind(...params).run()
    },
    async tx<T = Row>(stmts: Stmt[]) {
      const res = await db.batch<T>(stmts.map(bind))
      return res.map((r) => r.results ?? [])
    },
  }
}

export default createApp((c) => {
  const env = c.env as Bindings
  const cfg: Cfg = {
    AUTH_SECRET: env.AUTH_SECRET,
    PHONE_SALT: env.PHONE_SALT,
    TURNSTILE_SECRET: env.TURNSTILE_SECRET,
    TURNSTILE_SITEKEY: env.TURNSTILE_SITEKEY,
    EVENT_NAME: env.EVENT_NAME,
  }
  return { db: d1Adapter(env.DB), cfg }
})
