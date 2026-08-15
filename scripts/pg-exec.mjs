#!/usr/bin/env node
/**
 * 往 Neon（Postgres）里灌 SQL 文件。D1 那边用 `wrangler d1 execute --file=`，
 * Postgres 这边没有对应的 CLI，就用驱动自己跑一遍。
 *
 * 用法：
 *   DATABASE_URL='postgres://...' node scripts/pg-exec.mjs db/schema.pg.sql db/seed.sql
 *   （连接串从 Vercel 拉：vercel env pull .env.local --scope <team>）
 *
 * 整个文件当成一条多语句提交，Postgres 会把它包在一个隐式事务里，
 * 中途报错就整体回滚，不会留下半拉子表结构。
 */
import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('缺少 DATABASE_URL 环境变量')
  process.exit(1)
}
const files = process.argv.slice(2)
if (!files.length) {
  console.error('用法：DATABASE_URL=... node scripts/pg-exec.mjs <文件.sql> [更多.sql]')
  process.exit(1)
}

// 走 WebSocket 连接（而不是 HTTP 的 neon()），因为只有它支持一次提交多条语句
const pool = new Pool({ connectionString: url })
try {
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    process.stderr.write(`执行 ${file} ...`)
    await pool.query(text)
    process.stderr.write(' 完成\n')
  }
} finally {
  await pool.end()
}
