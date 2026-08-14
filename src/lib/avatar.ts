/** 名字 → 稳定的渐变头像。同一个人永远同一套颜色，不需要用户上传任何东西 */

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function avatarOf(name: string) {
  const h = hash(name || '?')
  const hue = h % 360
  const hue2 = (hue + 38 + (h % 40)) % 360
  return {
    from: `hsl(${hue} 82% 62%)`,
    to: `hsl(${hue2} 78% 46%)`,
    ring: `hsl(${hue} 90% 70%)`,
    initial: initialOf(name),
  }
}

/** 中文取姓（末字更容易重复，取首字更好认），英文取首字母 */
export function initialOf(name: string) {
  const s = String(name || '').trim()
  if (!s) return '?'
  const first = [...s][0]
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first
}

/** 座位小人手里笔记本屏幕上滚动的伪代码，按名字取不同片段，避免全场一模一样 */
const SNIPPETS = [
  ['deploy --env prod', 'ssh gateway', 'ok ✓'],
  ['docker compose up', 'pull model...', 'ready'],
  ['kubectl get pods', '3/3 Running', ''],
  ['pip install -r', 'building...', 'done'],
  ['git push origin', 'CI passed', ''],
  ['curl /health', '200 OK', ''],
  ['make offline-pkg', 'sha256 ✓', ''],
  ['rag index build', '12,480 docs', ''],
]

export function snippetOf(name: string) {
  return SNIPPETS[hash(name) % SNIPPETS.length]
}
