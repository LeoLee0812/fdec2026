import { useRef } from 'react'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/gsap'
import { ACCENT, type Topic } from '@/lib/api'
import { SeatPerson } from './SeatPerson'

const CX = 310
const CY = 310
const TABLE_R = 112 // 桌面半径
const SEAT_R = 200 // 座位圈半径

export function seatPos(i: number, total: number) {
  const rad = ((i * 360) / total) * (Math.PI / 180)
  return { x: CX + SEAT_R * Math.sin(rad), y: CY - SEAT_R * Math.cos(rad), angle: (i * 360) / total }
}

/** 用桌号做种子，保证每张桌的桌面小物件位置固定不乱跳 */
function rand(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
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
  const rnd = rand(topic.table_no)

  // 桌面小物件：中间一盆绿植，四周随机撒几个咖啡杯和手机
  const props_ = Array.from({ length: 5 }, (_, i) => {
    const ang = rnd() * Math.PI * 2
    const dist = 46 + rnd() * 58
    return { x: CX + Math.cos(ang) * dist, y: CY + Math.sin(ang) * dist, kind: i % 2 === 0 ? 'cup' : 'phone' }
  })

  useGSAP(
    () => {
      const reduce = prefersReducedMotion()

      // 桌面轮廓先画出来，再让座位从中心往外弹
      gsap.fromTo('.table-ring', { drawSVG: '0%' }, { drawSVG: '100%', duration: reduce ? 0 : 0.9, ease: 'power2.inOut' })
      gsap.fromTo(
        '.seat-node',
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: reduce ? 0.25 : 0.55,
          ease: reduce ? 'none' : 'back.out(1.8)',
          stagger: { each: 0.035, from: 'start' },
          transformOrigin: '0px 0px',
        },
      )
      gsap.fromTo(
        '.table-prop',
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.4,
          stagger: 0.05,
          delay: 0.3,
          transformOrigin: '0px 0px',
        },
      )

      if (reduce) return

      // 每个人敲键盘的节奏错开，不然十个人整整齐齐像仪仗队
      gsap.utils.toArray<SVGElement>('.seat-taken .code-line').forEach((line) => {
        gsap.to(line, {
          scaleX: () => 0.35 + Math.random() * 0.6,
          transformOrigin: 'left center',
          duration: 0.4 + Math.random() * 0.35,
          repeat: -1,
          yoyo: true,
          repeatRefresh: true,
          ease: 'sine.inOut',
          delay: Math.random() * 1.5,
        })
      })

      // 坐着的人轻微呼吸
      gsap.utils.toArray<SVGElement>('.seat-taken').forEach((node) => {
        gsap.to(node, {
          scale: 1.028,
          transformOrigin: '0px 0px',
          duration: 1.5 + Math.random(),
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 0.9 + Math.random() * 2, // 等入场动画落地再开始呼吸，否则两个 scale 会打架
        })
      })

      // 空位缓慢呼吸，提示可点
      gsap.to('.seat-empty circle:first-child', {
        opacity: 0.45,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: 0.12,
      })
    },
    { scope: root, dependencies: [topic.id, topic.taken.length], revertOnUpdate: true },
  )

  return (
    <svg
      ref={root}
      viewBox="55 45 510 535"
      className="w-full max-w-[600px] mx-auto touch-manipulation select-none"
      role="img"
      aria-label={`${topic.table_no} 号桌座位图`}
    >
      <defs>
        <radialGradient id={`table-${topic.id}`} cx="50%" cy="42%">
          <stop offset="0%" stopColor="#1a1f2c" />
          <stop offset="100%" stopColor="#0d111a" />
        </radialGradient>
        <filter id={`soft-${topic.id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      {/* 桌下的一团光 */}
      <circle cx={CX} cy={CY + 12} r={TABLE_R + 10} fill={a.main} opacity="0.13" filter={`url(#soft-${topic.id})`} />

      {/* 桌面 */}
      <circle cx={CX} cy={CY} r={TABLE_R} fill={`url(#table-${topic.id})`} />
      <circle
        className="table-ring"
        cx={CX}
        cy={CY}
        r={TABLE_R}
        fill="none"
        stroke={a.main}
        strokeOpacity="0.75"
        strokeWidth="2"
      />
      <circle cx={CX} cy={CY} r={TABLE_R - 13} fill="none" stroke={a.main} strokeOpacity="0.18" strokeWidth="1" />

      {/* 桌牌 */}
      <text x={CX} y={CY - 6} textAnchor="middle" fontSize="38" fontWeight="800" fill={a.main} opacity="0.9">
        {String(topic.table_no).padStart(2, '0')}
      </text>
      <text x={CX} y={CY + 18} textAnchor="middle" fontSize="13" fill="#8b93a7" letterSpacing="2">
        号桌 · {topic.capacity} 人
      </text>

      {/* 桌面小物件 */}
      <g transform={`translate(${CX} ${CY + 55})`}>
        <g className="table-prop">
          <ellipse cx="0" cy="7" rx="15" ry="9" fill="#1f6f4a" opacity="0.9" />
          <path d="M0 7 l0 -16" stroke="#2c9c68" strokeWidth="2.5" />
          <circle cx="0" cy="-11" r="7" fill="#3ec98a" />
        </g>
      </g>
      {props_.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
        <g className="table-prop">
          {p.kind === 'cup' ? (
            <>
              <circle r="7" fill="#e8ecf5" opacity="0.9" />
              <circle r="4" fill="#6b4a2f" />
            </>
          ) : (
            <rect x="-4" y="-7" width="8" height="14" rx="2" fill="#2a3040" stroke="#48506a" strokeWidth="0.8" />
          )}
        </g>
        </g>
      ))}

      {/* 座位 */}
      {Array.from({ length: topic.capacity }, (_, i) => {
        const pos = seatPos(i, topic.capacity)
        const s = taken.get(i)
        const isOwner = i === 0
        return (
          <SeatPerson
            key={i}
            seatNo={i}
            angle={pos.angle}
            x={pos.x}
            y={pos.y}
            accent={topic.accent}
            isOwner={isOwner}
            name={isOwner ? topic.owner_name : s?.name}
            mine={s?.mine}
            onClick={() => {
              if (isOwner) return
              if (s?.mine) onCancelSeat()
              else if (!s) onPickSeat(i)
            }}
          />
        )
      })}
    </svg>
  )
}
