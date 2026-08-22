export type Seat = { seat_no: number; name: string; mine: boolean }

export type Topic = {
  id: number
  table_no: number
  title: string
  owner_name: string
  capacity: number
  accent: AccentKey
  taken: Seat[]
}

export type MySeat = { topic_id: number; seat_no: number; title: string; table_no: number } | null

export type VenueState = {
  open: boolean
  notice: string
  me: { name: string }
  topics: Topic[]
  mySeat: MySeat
}

export type AccentKey = 'cyan' | 'violet' | 'magenta' | 'amber'

/** 具体色值写在 index.css 的两套主题变量里，这里只引用，切主题时自动跟随 */
export const ACCENT: Record<AccentKey, { main: string; soft: string; deep: string }> = {
  cyan: { main: 'var(--ac-cyan)', soft: 'var(--ac-cyan-soft)', deep: 'var(--ac-cyan-deep)' },
  violet: { main: 'var(--ac-violet)', soft: 'var(--ac-violet-soft)', deep: 'var(--ac-violet-deep)' },
  magenta: { main: 'var(--ac-magenta)', soft: 'var(--ac-magenta-soft)', deep: 'var(--ac-magenta-deep)' },
  amber: { main: 'var(--ac-amber)', soft: 'var(--ac-amber-soft)', deep: 'var(--ac-amber-deep)' },
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new ApiError('网络连接失败，请检查网络后重试', 0)
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new ApiError(data.error || '请求失败', res.status)
  return data as T
}

export const api = {
  siteConfig: () => req<{ event: string; turnstileSiteKey: string }>('/api/config'),
  login: (body: { name: string; phone: string; invite_code?: string; turnstile?: string; hp?: string }) =>
    req<{ name: string }>('/api/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => req<{ ok: true }>('/api/logout', { method: 'POST' }),
  state: () => req<VenueState>('/api/state'),
  select: (topic_id: number, seat_no: number) =>
    req<VenueState>('/api/select', { method: 'POST', body: JSON.stringify({ topic_id, seat_no }) }),
  unselect: () => req<VenueState>('/api/unselect', { method: 'POST' }),
}
