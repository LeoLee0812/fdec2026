#!/usr/bin/env node
/**
 * 生成邀请码 SQL。
 *   node scripts/gen-invites.mjs 30            → 30 个一人一码（用完即废）
 *   node scripts/gen-invites.mjs 1 --universal --quota=20 --hours=6
 *                                              → 1 个现场万能码，限 20 人、6 小时内有效
 */
import { randomBytes } from 'node:crypto'

const args = process.argv.slice(2)
const count = Number(args[0] || 20)
const universal = args.includes('--universal')
const quota = Number((args.find((a) => a.startsWith('--quota=')) || '').split('=')[1] || (universal ? 20 : 1))
const hours = Number((args.find((a) => a.startsWith('--hours=')) || '').split('=')[1] || 0)

// 去掉容易看错的 0/O/1/I
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const chunk = (n) =>
  [...randomBytes(n)].map((b) => ALPHABET[b % ALPHABET.length]).join('')

const now = Date.now()
const expires = hours ? Math.floor(now / 1000) + hours * 3600 : null
const rows = []
const codes = []
for (let i = 0; i < count; i++) {
  const code = `FDE-${chunk(4)}-${chunk(4)}`
  codes.push(code)
  rows.push(
    `('${code}', '${universal ? 'universal' : 'personal'}', ${quota}, 0, ${
      universal ? "'现场万能码'" : "'临时来宾'"
    }, ${expires ?? 'NULL'}, 1, ${now})`,
  )
}

console.log('INSERT INTO invite_codes (code, kind, quota, used, note, expires_at, active, created_at) VALUES')
console.log(rows.join(',\n') + ';')
console.error(codes.join('\n'))
