import { useRef } from 'react'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/gsap'
import { ACCENT, type Topic } from '@/lib/api'

const COLS = 4
const COL_X = [200, 405, 610, 815]
const ROW_Y = [330, 512, 694, 876, 1058]
const TABLE_R = 60
const DOT_R = 80

type Props = {
  topics: Topic[]
  myTopicId?: number
  onOpen: (topic: Topic) => void
}

/** 全场 20 桌俯视平面图，按现场摆位排列：舞台在上，签到处在下 */
export function VenueMap({ topics, myTopicId, onOpen }: Props) {
  const root = useRef<SVGSVGElement>(null)

  useGSAP(
    () => {
      const reduce = prefersReducedMotion()
      if (reduce) {
        gsap.fromTo('.venue-table', { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.01 })
        return
      }
      gsap.fromTo('.venue-stage', { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
      // 从场地中心往外一圈圈亮起来
      // SVG 上必须用 svgOrigin（每桌自己的圆心），用 transformOrigin:'center' 会留下补偿平移，整桌歪掉
      gsap.fromTo(
        '.venue-table',
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.55,
          ease: 'back.out(1.7)',
          svgOrigin: (_i: number, el: Element) => (el as SVGGElement).dataset.origin || '505 595',
          stagger: { each: 0.035, from: 'center', grid: [5, COLS] },
          clearProps: 'transform', // 动画留下的补偿平移必须清掉，否则整桌歪着不动了
        },
      )
      gsap.fromTo(
        '.venue-ring',
        { drawSVG: '0%' },
        { drawSVG: '100%', duration: 0.9, stagger: 0.02, delay: 0.2, ease: 'power2.inOut' },
      )
      gsap.to('.venue-mine', { opacity: 0.35, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    },
    { scope: root, dependencies: [topics.length, myTopicId], revertOnUpdate: true },
  )

  return (
    <svg ref={root} viewBox="0 0 1010 1190" className="w-full select-none" role="img" aria-label="会场平面图">
      {/* 场地边框 */}
      <rect x="24" y="24" width="962" height="1142" rx="26" fill="rgba(255,255,255,.015)" stroke="#232838" strokeWidth="1.5" />

      {/* 舞台 */}
      <g className="venue-stage">
        <rect x="205" y="62" width="600" height="98" rx="14" fill="#11141d" stroke="#38e1ff" strokeOpacity="0.5" strokeWidth="1.5" />
        <text x="505" y="105" textAnchor="middle" fontSize="26" fontWeight="800" fill="#38e1ff" letterSpacing="4">
          舞台 / 主讲区
        </text>
        <text x="505" y="134" textAnchor="middle" fontSize="15" fill="#6c7488" letterSpacing="2">
          FDEC 2026 · 湖畔良仓 21 号楼
        </text>
      </g>

      {topics.map((t, i) => {
        const cx = COL_X[i % COLS]
        const cy = ROW_Y[Math.floor(i / COLS)]
        const a = ACCENT[t.accent]
        const seated = t.taken.length
        const total = t.capacity - 1
        const full = seated >= total
        const mine = t.id === myTopicId

        return (
          <g
            key={t.id}
            data-origin={`${cx} ${cy}`}
            className="venue-table cursor-pointer"
            onClick={() => onOpen(t)}
            role="button"
            aria-label={`${t.table_no} 号桌 ${t.title}`}
          >
            {mine && <circle className="venue-mine" cx={cx} cy={cy} r={DOT_R + 16} fill={a.main} opacity="0.18" />}

            {/* 座位小点：坐满的点亮 */}
            {Array.from({ length: t.capacity }, (_, s) => {
              const rad = ((s * 360) / t.capacity) * (Math.PI / 180)
              const occupied = s === 0 || t.taken.some((x) => x.seat_no === s)
              const isMe = t.taken.some((x) => x.seat_no === s && x.mine)
              return (
                <circle
                  key={s}
                  cx={cx + DOT_R * Math.sin(rad)}
                  cy={cy - DOT_R * Math.cos(rad)}
                  r={isMe ? 9 : 7}
                  fill={isMe ? '#fff' : occupied ? a.main : '#1b2030'}
                  stroke={occupied ? 'none' : '#2c3346'}
                  strokeWidth="1.2"
                  opacity={occupied ? 0.92 : 1}
                />
              )
            })}

            <circle cx={cx} cy={cy} r={TABLE_R} fill="#0f131c" />
            <circle
              className="venue-ring"
              cx={cx}
              cy={cy}
              r={TABLE_R}
              fill="none"
              stroke={full ? '#39405480' : a.main}
              strokeOpacity={full ? 0.5 : 0.85}
              strokeWidth={mine ? 3 : 1.8}
            />
            <text x={cx} y={cy + 2} textAnchor="middle" fontSize="30" fontWeight="800" fill={full ? '#59617a' : a.main}>
              {String(t.table_no).padStart(2, '0')}
            </text>
            <text x={cx} y={cy + 26} textAnchor="middle" fontSize="14" fill={full ? '#59617a' : '#9aa3b8'}>
              {full ? '已坐满' : `余 ${total - seated}`}
            </text>
            <text x={cx} y={cy + DOT_R + 34} textAnchor="middle" fontSize="15" fill="#c3cad9">
              {t.title.length > 11 ? t.title.slice(0, 11) + '…' : t.title}
            </text>
          </g>
        )
      })}

      {/* 签到处 */}
      <g>
        <rect x="420" y="1104" width="170" height="42" rx="10" fill="#11141d" stroke="#232838" />
        <text x="505" y="1131" textAnchor="middle" fontSize="16" fill="#8b93a7" letterSpacing="2">
          入口 / 签到处
        </text>
      </g>
    </svg>
  )
}
