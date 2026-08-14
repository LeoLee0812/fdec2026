import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { ACCENT, type Topic } from '@/lib/api'
import { Check, Users } from 'lucide-react'

type Props = { topics: Topic[]; myTopicId?: number; onOpen: (t: Topic) => void }

export function TopicList({ topics, myTopicId, onOpen }: Props) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      gsap.fromTo(
        '.tp-card',
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: { each: 0.04, from: 'start' } },
      )
    },
    { scope: root, dependencies: [topics.length], revertOnUpdate: true },
  )

  return (
    <div ref={root} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((t) => {
        const a = ACCENT[t.accent]
        const total = t.capacity
        const left = total - t.taken.length
        const pct = Math.round((t.taken.length / total) * 100)
        const mine = t.id === myTopicId
        return (
          <button
            key={t.id}
            onClick={() => onOpen(t)}
            className="tp-card group relative overflow-hidden rounded-2xl border border-line bg-panel/70 p-4 text-left transition hover:border-white/25 hover:bg-panel"
            style={mine ? { borderColor: a.main, boxShadow: `0 0 26px ${a.soft}` } : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[26px] font-black leading-none" style={{ color: a.main }}>
                {String(t.table_no).padStart(2, '0')}
              </span>
              {mine ? (
                <span
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: a.soft, color: a.main }}
                >
                  <Check className="size-3" />
                  我的桌
                </span>
              ) : (
                <span className={`text-[12px] font-semibold ${left ? 'text-fog' : 'text-magenta'}`}>
                  {left ? `余 ${left} 座` : '已坐满'}
                </span>
              )}
            </div>

            <h3 className="mt-3 line-clamp-2 min-h-[44px] text-[15px] font-bold leading-snug text-white/92">{t.title}</h3>

            <div className="mt-3 flex items-center gap-2 text-[12px] text-fog">
              <Users className="size-3.5" />
              {t.capacity} 人圆桌 · 已坐 {t.taken.length} 人
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
              <i className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: a.main }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}
