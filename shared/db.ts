/**
 * 数据库抽象层：让同一份业务逻辑既能跑在 Cloudflare D1（SQLite）上，
 * 也能跑在 Vercel + Neon（Postgres）上。
 *
 * 约定：
 * - SQL 一律用 `?` 占位符，Postgres 适配器负责转成 $1/$2；
 * - 需要自增主键时统一用 `INSERT ... RETURNING id`，两种数据库都支持；
 * - 标识符里凡是可能撞关键字的（如 audit_log."at"、config."key"）都加双引号。
 */

export type Row = Record<string, any>

export type Stmt = { sql: string; params?: unknown[] }

export interface Db {
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>
  first<T = Row>(sql: string, params?: unknown[]): Promise<T | null>
  run(sql: string, params?: unknown[]): Promise<void>
  /** 一组语句原子执行；返回每条语句各自的结果行 */
  tx<T = Row>(stmts: Stmt[]): Promise<T[][]>
}

/** 业务需要的环境配置，两端各自从 c.env / process.env 取 */
export type Cfg = {
  AUTH_SECRET: string
  PHONE_SALT: string
  TURNSTILE_SECRET?: string
  TURNSTILE_SITEKEY?: string
  EVENT_NAME: string
}
