import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { track } from '@/lib/analytics'
import { api, ApiError, type Topic, type VenueState } from '@/lib/api'
import { confettiBurst } from '@/lib/confetti'
import { Cover } from '@/components/Cover'
import { Login } from '@/components/Login'
import { VenueMap } from '@/components/venue/VenueMap'
import { TopicList } from '@/components/venue/TopicList'
import { TableDetail } from '@/components/seat/TableDetail'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LayoutGrid, LogOut, Map, RotateCcw } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

type View = 'cover' | 'login' | 'main'
type Pending = { kind: 'select'; topic: Topic; seatNo: number } | { kind: 'cancel' } | null

export default function App() {
  const [view, setView] = useState<View>('cover')
  const [booted, setBooted] = useState(false)
  const [state, setState] = useState<VenueState | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [tab, setTab] = useState<'map' | 'list'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'map',
  )
  const [siteKey, setSiteKey] = useState('')
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    try {
      setState(await api.state())
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setState(null)
      return false
    }
  }, [])

  // 首屏：拿站点配置 + 用 cookie 试着恢复登录态
  useEffect(() => {
    api.siteConfig().then((c) => setSiteKey(c.turnstileSiteKey)).catch(() => {})
    refresh().finally(() => setBooted(true))
  }, [refresh])

  // 进入主界面后每 3 秒同步一次，别人抢座能实时看到
  useEffect(() => {
    if (view !== 'main' || !state) return
    const t = setInterval(() => {
      if (!pending && !busy.current && document.visibilityState === 'visible') refresh()
    }, 3000)
    return () => clearInterval(t)
  }, [view, state, pending, refresh])

  const openTopic = state?.topics.find((t) => t.id === openId) ?? null

  // 嘉宾桌等锁定的桌子不开放选座，点了只提示、不进详情页
  function openTable(t: Topic) {
    if (t.locked) {
      toast('当前桌无法选择')
      return
    }
    setOpenId(t.id)
  }

  async function commit() {
    const p = pending
    setPending(null)
    if (!p) return
    busy.current = true
    try {
      if (p.kind === 'cancel') {
        setState(await api.unselect())
        track('seat_cancel')
        toast('已取消座位')
      } else {
        setState(await api.select(p.topic.id, p.seatNo))
        track('seat_select', { table: p.topic.table_no, topic: p.topic.title, seat: p.seatNo })
        confettiBurst()
        toast.success(`入座成功 · ${p.topic.table_no} 号桌`, { description: p.topic.title })
      }
    } catch (e) {
      track('seat_error', { kind: p.kind, message: e instanceof ApiError ? e.message : '未知错误' })
      toast.error(e instanceof ApiError ? e.message : '操作失败')
      refresh()
    } finally {
      busy.current = false
    }
  }

  async function logout() {
    await api.logout().catch(() => {})
    setState(null)
    setOpenId(null)
    setView('cover')
  }

  if (!booted) {
    return (
      <div className="bg-aurora grid min-h-dvh place-items-center">
        <span className="font-mono text-sm text-fog">载入中...</span>
      </div>
    )
  }

  const openTopics = state ? state.topics.filter((t) => !t.locked) : []
  const totalSeats = state ? openTopics.reduce((n, t) => n + t.capacity, 0) : 200
  const takenSeats = state ? openTopics.reduce((n, t) => n + t.taken.length, 0) : 0

  if (view === 'cover') {
    return (
      <Cover
        stats={{ tables: state ? openTopics.length : 20, seats: totalSeats, left: totalSeats - takenSeats }}
        entryText={!state ? '开始选择话题与座位' : state.mySeat ? '查看我的座位' : '还没选座，赶紧挑一个'}
        onStart={() => {
          track('cover_start', { logged_in: Boolean(state) })
          setView(state ? 'main' : 'login')
        }}
      />
    )
  }

  if (view === 'login' || !state) {
    return (
      <Login
        siteKey={siteKey}
        onBack={() => setView('cover')}
        onLoggedIn={async () => {
          track('login_success')
          await refresh()
          setView('main')
        }}
      />
    )
  }

  const myTopic = state.mySeat ? state.topics.find((t) => t.id === state.mySeat!.topic_id) : undefined

  return (
    <div className="bg-aurora relative min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={() => setView('cover')} className="flex items-center gap-2.5">
            <img src="/openfde-mark.png" alt="OpenFDE" className="size-6 invert dark:invert-0" />
            <span className="whitespace-nowrap text-[13px] font-bold tracking-wide">
              FDEC 2026<span className="hidden sm:inline"> · 会场选座</span>
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-lg border border-line p-0.5">
              <button
                onClick={() => setTab('map')}
                className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] ${tab === 'map' ? 'bg-fg/10 text-fg' : 'text-fog'}`}
              >
                <Map className="size-3.5" />
                平面图
              </button>
              <button
                onClick={() => setTab('list')}
                className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] ${tab === 'list' ? 'bg-fg/10 text-fg' : 'text-fog'}`}
              >
                <LayoutGrid className="size-3.5" />
                列表
              </button>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={logout} className="text-fog hover:text-fg" title="退出">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-32 pt-4">
        {state.notice && (
          <div className="mb-4 border-l-2 border-[var(--alert)] bg-panel px-4 py-3 text-[13px] text-fg">
            {state.notice}
          </div>
        )}
        {!state.open && (
          <div className="mb-4 border border-line bg-panel px-4 py-3 text-[13px] text-fog">
            选座已锁定，如需调整请联系现场工作人员。
          </div>
        )}

        {tab === 'map' ? (
          <div className="border border-line bg-panel/40 p-2 sm:p-4">
            <VenueMap topics={state.topics} myTopicId={myTopic?.id} onOpen={openTable} />
          </div>
        ) : (
          <TopicList topics={state.topics} myTopicId={myTopic?.id} onOpen={openTable} />
        )}
      </main>

      {/* 底部我的座位条 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/92 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] text-fog">{state.me.name}</p>
            {state.mySeat ? (
              <p className="truncate text-[13.5px] font-bold">
                {state.mySeat.table_no} 号桌 · {state.mySeat.title}
              </p>
            ) : (
              <p className="text-[13.5px] font-bold text-amber">还没有选择话题，赶紧选一个</p>
            )}
          </div>
          {state.mySeat && state.open && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPending({ kind: 'cancel' })}
              className="shrink-0 border-line bg-transparent text-fog"
            >
              <RotateCcw className="mr-1 size-3.5" />
              取消座位
            </Button>
          )}
        </div>
      </div>

      {openTopic && (
        <TableDetail
          topic={openTopic}
          hasSeatElsewhere={!!state.mySeat && state.mySeat.topic_id !== openTopic.id}
          onClose={() => setOpenId(null)}
          onPickSeat={(seatNo) => {
            if (!state.open) return toast('选座已锁定')
            setPending({ kind: 'select', topic: openTopic, seatNo })
          }}
          onCancelSeat={() => {
            if (!state.open) return toast('选座已锁定')
            setPending({ kind: 'cancel' })
          }}
        />
      )}

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-[19.5rem] rounded-none border-line bg-panel sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{pending?.kind === 'cancel' ? '取消当前座位？' : '确认坐这个位置？'}</DialogTitle>
            <DialogDescription className="text-fog">
              {pending?.kind === 'cancel' ? (
                '取消后座位会立刻空出来，可能被其他人选走。'
              ) : pending ? (
                <>
                  话题《{pending.topic.title}》
                  {state.mySeat && state.mySeat.topic_id !== pending.topic.id && '，原来的位置会自动释放。'}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPending(null)} className="border-line bg-transparent">
              再想想
            </Button>
            <Button onClick={commit} className="bg-fg font-bold text-ink hover:opacity-90">
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
