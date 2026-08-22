import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { ACCENT, type Topic } from '@/lib/api'
import { TableScene } from './TableScene'
import { ChevronLeft, Info } from 'lucide-react'

type Props = {
  topic: Topic
  hasSeatElsewhere: boolean
  onClose: () => void
  onPickSeat: (seatNo: number) => void
  onCancelSeat: () => void
}

export function TableDetail({ topic, hasSeatElsewhere, onClose, onPickSeat, onCancelSeat }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const a = ACCENT[topic.accent]
  const left = topic.capacity - topic.taken.length

  useGSAP(
    () => {
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.25 })
        .fromTo('.dt-card', { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06 }, '-=0.1')
    },
    { scope: root, dependencies: [topic.id], revertOnUpdate: true },
  )

  return (
    <div ref={root} className="fixed inset-0 z-40 overflow-y-auto bg-ink/97 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl px-4 pb-[calc(40px+env(safe-area-inset-bottom))] pt-4">
        <button onClick={onClose} className="flex items-center gap-1 py-2 text-sm text-fog hover:text-fg">
          <ChevronLeft className="size-4" />
          返回全场
        </button>

        {/* 话题卡 */}
        <section className="dt-card border border-line bg-panel/80 p-5">
          <div className="flex items-center justify-between font-mono text-[11px] font-bold tracking-[.14em]" style={{ color: a.main }}>
            <span>TOPIC {String(topic.table_no).padStart(2, '0')}</span>
            <span className="px-2 py-0.5" style={{ background: a.soft }}>
              {topic.table_no} 号桌
            </span>
          </div>
          <h2 className="mt-3 text-[22px] font-black leading-snug">{topic.title}</h2>
          <div className="mt-4 flex items-center justify-between text-[13px]">
            <span className="text-fg/80">
              {topic.capacity} 人方桌 · 已坐 <b>{topic.taken.length}</b> 人
            </span>
            <span style={{ color: left ? a.main : 'var(--ac-magenta)' }} className="font-bold">
              {left ? `还剩 ${left} 个座位` : '本桌已坐满'}
            </span>
          </div>
        </section>

        {/* 座位图 */}
        <section className="dt-card mt-4 border border-line bg-panel/60 px-2 pb-4 pt-5">
          <div className="mb-1 flex items-baseline justify-between px-3">
            <h3 className="text-[17px] font-bold">选择一个位置</h3>
            <span className="text-[12px] text-fog">按现场方位排列</span>
          </div>
          <TableScene topic={topic} onPickSeat={onPickSeat} onCancelSeat={onCancelSeat} />
          <p className="mt-1 flex items-center justify-center gap-1.5 px-4 text-center text-[12.5px] text-fog">
            <Info className="size-3.5 shrink-0" />
            {hasSeatElsewhere ? '点空位入座，会自动从原座位换过来' : '点一个空位就能入座，之后可以随时更换'}
          </p>
        </section>
      </div>
    </div>
  )
}
