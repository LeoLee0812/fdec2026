import { useRef } from 'react'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/gsap'
import { ACCENT, type Topic } from '@/lib/api'
import { SeatPerson } from './SeatPerson'

/** 口字桌：4 张长条桌拼成一个方框，中间空出来。原点就是桌心 */
const HALF = 100 // 外框半边
const INNER = 58 // 中空半边
const SEAT_OUT = 128 // 座位中心到桌心的距离（短边方向）

/**
 * 10 个座位按现场摆法分布：上下短边各 2 人，左右长边各 3 人。
 * angle 就是 rotate 的度数，转完之后每个座位的局部 +y 都指向桌心。
 */
export function seatLayout(total: number) {
  if (total === 10) {
    return [
      { x: -45, y: -SEAT_OUT, angle: 0 },
      { x: 45, y: -SEAT_OUT, angle: 0 },
      { x: SEAT_OUT, y: -62, angle: 90 },
      { x: SEAT_OUT, y: 0, angle: 90 },
      { x: SEAT_OUT, y: 62, angle: 90 },
      { x: 45, y: SEAT_OUT, angle: 180 },
      { x: -45, y: SEAT_OUT, angle: 180 },
      { x: -SEAT_OUT, y: 62, angle: 270 },
      { x: -SEAT_OUT, y: 0, angle: 270 },
      { x: -SEAT_OUT, y: -62, angle: 270 },
    ]
  }
  // 兜底：沿外接圆均分
  return Array.from({ length: total }, (_, i) => {
    const rad = ((i * 360) / total) * (Math.PI / 180)
    return { x: SEAT_OUT * Math.sin(rad), y: -SEAT_OUT * Math.cos(rad), angle: (i * 360) / total }
  })
}

type Props = {
  topic: Topic
  onPickSeat: (seatNo: number) => void
  onCancelSeat: () => void
}

export function TableScene({ topic, onPickSeat, onCancelSeat }: Props) {
  const root = useRef<SVGSVGElement>(null)
  const a = ACCENT[topic.accent]
  const taken = new Map(topic.taken.map((s) => [s.seat_no, s]))
  const seats = seatLayout(topic.capacity)

  useGSAP(
    () => {
      const reduce = prefersReducedMotion()
      gsap.fromTo('.tbl-top', { opacity: 0 }, { opacity: 1, duration: reduce ? 0.2 : 0.5, ease: 'power2.out' })
      gsap.fromTo(
        '.seat-node',
        { opacity: 0, y: 6 },
        {
          opacity: 1,
          y: 0,
          duration: reduce ? 0.2 : 0.4,
          ease: 'power2.out',
          stagger: { each: 0.04 },
        },
      )
    },
    { scope: root, dependencies: [topic.id, topic.taken.length], revertOnUpdate: true },
  )

  return (
    <svg
      ref={root}
      viewBox="-185 -185 370 370"
      className="mx-auto w-full max-w-[560px] select-none"
      role="img"
      aria-label={`${topic.table_no} 号桌座位图`}
    >
      {/* 桌面：外框挖掉中间，evenodd 一笔画出口字 */}
      <g className="tbl-top">
        <path
          d={`M${-HALF},${-HALF} H${HALF} V${HALF} H${-HALF} Z M${-INNER},${-INNER} H${INNER} V${INNER} H${-INNER} Z`}
          fillRule="evenodd"
          fill="var(--paper)"
          stroke="var(--paper-line)"
          strokeWidth="1.5"
        />
        {/* 四个角的拼缝，说明是 4 张长条桌拼的 */}
        <g stroke="var(--paper-line)" strokeWidth="1" strokeOpacity="0.55">
          <line x1={-HALF} y1={-HALF} x2={-INNER} y2={-INNER} />
          <line x1={HALF} y1={-HALF} x2={INNER} y2={-INNER} />
          <line x1={HALF} y1={HALF} x2={INNER} y2={INNER} />
          <line x1={-HALF} y1={HALF} x2={-INNER} y2={INNER} />
        </g>

        {/* 中空区域里的桌号 */}
        <text textAnchor="middle" y="-4" fontSize="40" fontWeight="800" fill={a.main} letterSpacing="-1">
          {String(topic.table_no).padStart(2, '0')}
        </text>
        <text textAnchor="middle" y="20" fontSize="11" fill="var(--color-fog)" letterSpacing="3">
          号桌 · {topic.capacity} 人
        </text>
      </g>

      {seats.map((pos, i) => {
        const s = taken.get(i)
        return (
          <SeatPerson
            key={i}
            seatNo={i}
            angle={pos.angle}
            x={pos.x}
            y={pos.y}
            accent={topic.accent}
            name={s?.name}
            mine={s?.mine}
            onClick={() => {
              if (s?.mine) onCancelSeat()
              else if (!s) onPickSeat(i)
            }}
          />
        )
      })}
    </svg>
  )
}
