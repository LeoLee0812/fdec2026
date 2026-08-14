#!/usr/bin/env node
/**
 * 把报名表 CSV 转成可直接执行的 SQL：手机号在本地就算成 HMAC 摘要，明文永远不进数据库。
 *
 * 用法：
 *   PHONE_SALT=xxx node scripts/import-attendees.mjs 报名表.csv > db/attendees.sql
 *   npx wrangler d1 execute fdec2026 --remote --file=db/attendees.sql
 *
 * CSV 表头需要包含：姓名,手机号（可选：公司,职位）
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const salt = process.env.PHONE_SALT
if (!salt) {
  console.error('缺少 PHONE_SALT 环境变量，必须与线上 secret 完全一致')
  process.exit(1)
}
const file = process.argv[2]
if (!file) {
  console.error('用法：PHONE_SALT=xxx node scripts/import-attendees.mjs 报名表.csv')
  process.exit(1)
}

const hash = (phone) => createHmac('sha256', salt).update(`phone:${String(phone).replace(/\D/g, '')}`).digest('hex')
const esc = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`

const text = readFileSync(file, 'utf8').replace(/^﻿/, '')
const rows = text
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))

const head = rows.shift()
const idx = (names) => head.findIndex((h) => names.some((n) => h.includes(n)))
const iName = idx(['姓名', 'name'])
const iPhone = idx(['手机', '电话', 'phone', 'mobile'])
const iCompany = idx(['公司', '单位', 'company'])
const iTitle = idx(['职位', '岗位', 'title'])

if (iName < 0 || iPhone < 0) {
  console.error('CSV 里找不到「姓名」或「手机号」列，实际表头：', head.join(' | '))
  process.exit(1)
}

const now = Date.now()
const seen = new Set()
const values = []
for (const r of rows) {
  const name = r[iName]
  const phone = String(r[iPhone] || '').replace(/\D/g, '')
  if (!name || phone.length < 6) continue
  const h = hash(phone)
  if (seen.has(h)) continue // 同一个手机号只留第一条
  seen.add(h)
  values.push(
    `(${esc(name)}, ${esc(h)}, ${esc(phone.slice(-4))}, ${esc(iCompany >= 0 ? r[iCompany] : '')}, ${esc(
      iTitle >= 0 ? r[iTitle] : '',
    )}, 'whitelist', ${now})`,
  )
}

console.log('-- 由 scripts/import-attendees.mjs 生成，手机号已做 HMAC 摘要')
console.log(
  'INSERT OR IGNORE INTO attendees (name, phone_hash, phone_tail, company, job_title, source, created_at) VALUES',
)
console.log(values.join(',\n') + ';')
console.error(`已生成 ${values.length} 条参会者记录`)
