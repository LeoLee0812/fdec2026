import { useRef } from 'react'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/gsap'
import { ACCENT, type Topic } from '@/lib/api'
import { Check } from 'lucide-react'

type Props = {
  topics: Topic[]
  myTopicId?: number
  onOpen: (topic: Topic) => void
}

/** 平面图里的一张迷你口字桌：4 张长条桌拼成方框，外圈 10 把椅子 */
function MiniTable({ topic, mine }: { topic: Topic; mine: boolean }) {
  const a = ACCENT[topic.accent]
  const taken = new Set(topic.taken.map((s) => s.seat_no))
  const full = topic.taken.length >= topic.capacity
  // 与详情页同一套摆法：上下短边各 2 人，左右长边各 3 人
  const chairs = [
    { x: -13, y: -37, w: 18, h: 11 },
    { x: 13, y: -37, w: 18, h: 11 },
    { x: 37, y: -18, w: 11, h: 16 },
    { x: 37, y: 0, w: 11, h: 16 },
    { x: 37, y: 18, w: 11, h: 16 },
    { x: 13, y: 37, w: 18, h: 11 },
    { x: -13, y: 37, w: 18, h: 11 },
    { x: -37, y: 18, w: 11, h: 16 },
    { x: -37, y: 0, w: 11, h: 16 },
    { x: -37, y: -18, w: 11, h: 16 },
  ]

  return (
    <svg viewBox="-50 -50 100 100" className="w-full">
      {chairs.map((c, i) => (
        <rect
          key={i}
          x={c.x - c.w / 2}
          y={c.y - c.h / 2}
          width={c.w}
          height={c.h}
          rx="2.5"
          fill={taken.has(i) ? a.main : 'var(--chair)'}
          fillOpacity={taken.has(i) ? 1 : 0.5}
        />
      ))}
      <path
        d="M-28,-28 H28 V28 H-28 Z M-14,-14 H14 V14 H-14 Z"
        fillRule="evenodd"
        fill="var(--paper)"
        fillOpacity={full ? 0.4 : 1}
        stroke={mine ? 'var(--alert)' : 'var(--paper-line)'}
        strokeWidth={mine ? 2 : 1}
      />
      <text
        textAnchor="middle"
        y="5"
        fontSize="17"
        fontWeight="800"
        fill={full ? 'var(--color-fog)' : mine ? 'var(--alert)' : 'var(--color-fg)'}
      >
        {String(topic.table_no).padStart(2, '0')}
      </text>
    </svg>
  )
}

/** 全场平面图：20 张桌按现场摆位 4 列 × 5 行，舞台在上、签到处在下 */
export function VenueMap({ topics, myTopicId, onOpen }: Props) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const reduce = prefersReducedMotion()
      gsap.fromTo('.vm-stage', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' })
      gsap.fromTo(
        '.vm-table',
        { opacity: 0, y: reduce ? 0 : 10 },
        { opacity: 1, y: 0, duration: reduce ? 0.2 : 0.4, ease: 'power2.out', stagger: { each: 0.025 } },
      )
    },
    { scope: root, dependencies: [topics.length, myTopicId], revertOnUpdate: true },
  )

  return (
    <div ref={root} className="mx-auto max-w-4xl px-1 py-1">
      {/* 舞台 */}
      <div className="vm-stage mx-auto mb-6 max-w-lg border border-line bg-panel px-5 py-3 text-center sm:mb-8">
        <p className="text-[15px] font-black tracking-[0.34em] sm:text-[17px]">舞台 / 主讲区</p>
        <p className="mt-1 text-[10.5px] tracking-[0.2em] text-fog sm:text-[11.5px]">湖畔良仓 21 号楼 · 8 月 22 日</p>
      </div>

      {/* 固定 4 列 × 5 行，与现场摆位一一对应，手机上也不改列数 */}
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:gap-x-5 sm:gap-y-6">
        {topics.map((t) => {
          const left = t.capacity - t.taken.length
          const full = left <= 0
          const mine = t.id === myTopicId
          return (
            <button
              key={t.id}
              onClick={() => onOpen(t)}
              title={t.title}
              className="vm-table group flex flex-col items-center outline-none"
            >
              <div className="w-full transition-transform duration-200 group-hover:-translate-y-0.5">
                <MiniTable topic={t} mine={mine} />
              </div>
              <span
                className={`mt-0.5 whitespace-nowrap text-[10px] font-bold sm:text-[11.5px] ${
                  mine ? 'text-[var(--alert)]' : full ? 'text-fog' : 'text-fg/70'
                }`}
              >
                {mine ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Check className="size-2.5" />
                    我的桌
                  </span>
                ) : full ? (
                  '坐满'
                ) : (
                  `余 ${left}`
                )}
              </span>
              <p className="mt-1 hidden line-clamp-2 px-1 text-center text-[12px] leading-snug text-fog transition group-hover:text-fg/90 sm:block">
                {t.title}
              </p>
            </button>
          )
        })}
      </div>

      <div className="mx-auto mt-7 max-w-xs border border-line bg-panel py-2 text-center text-[11.5px] tracking-[0.2em] text-fog">
        入口 / 签到处
      </div>
    </div>
  )
}
