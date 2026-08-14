import { avatarOf } from '@/lib/avatar'
import { ACCENT, type AccentKey } from '@/lib/api'

type Props = {
  seatNo: number
  angle: number
  x: number
  y: number
  name?: string
  mine?: boolean
  accent: AccentKey
  onClick?: () => void
}

/**
 * 一个座位 = 一把俯视的椅子 +（坐了人时）一个头像。
 * 局部坐标约定：原点是椅子中心，+y 指向桌心，所以整组只要 rotate(角度) 就自动朝向桌子。
 * 文字要再 rotate(-角度) 转回来，否则侧面和下方的名字是倒着的。
 */
export function SeatPerson({ seatNo, angle, x, y, name, mine, accent, onClick }: Props) {
  const a = ACCENT[accent]
  const empty = !name

  // 定位放外层 <g>，动画只作用于没有 transform 的内层，
  // 否则 GSAP 改写 transform 矩阵时会把定位一起吃掉
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <g
        className={`seat-node ${empty ? 'seat-empty' : 'seat-taken'}${mine ? ' seat-mine' : ''} cursor-pointer`}
        data-seat={seatNo}
        onClick={onClick}
      >
        {empty ? (
          <>
            {/* 空椅子：虚线勾一把 */}
            <rect x="-21" y="-19" width="42" height="9" rx="3" fill="none" stroke="var(--color-line)" strokeWidth="1.6" />
            <rect
              x="-19"
              y="-9"
              width="38"
              height="32"
              rx="6"
              fill="none"
              stroke="var(--color-fog)"
              strokeOpacity="0.6"
              strokeWidth="1.4"
              strokeDasharray="4 5"
            />
            <g transform={`rotate(${-angle})`}>
              <text textAnchor="middle" y="11" fontSize="11" fill="var(--color-fog)">
                空位
              </text>
            </g>
          </>
        ) : (
          <>
            {/* 椅背 + 椅座 */}
            <rect x="-21" y="-19" width="42" height="9" rx="3" fill={mine ? a.main : 'var(--chair)'} />
            <rect
              x="-19"
              y="-9"
              width="38"
              height="32"
              rx="6"
              fill="var(--chair)"
              stroke={mine ? a.main : 'var(--color-line)'}
              strokeWidth={mine ? 2 : 1}
            />
            {/* 头像 */}
            <defs>
              <linearGradient id={`av-${accent}-${seatNo}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={avatarOf(name!).from} />
                <stop offset="100%" stopColor={avatarOf(name!).to} />
              </linearGradient>
            </defs>
            <circle cx="0" cy="7" r="14" fill={`url(#av-${accent}-${seatNo})`} />
            <g transform={`translate(0 7) rotate(${-angle})`}>
              <text textAnchor="middle" y="5" fontSize="13" fontWeight="700" fill="#101014">
                {avatarOf(name!).initial}
              </text>
            </g>
            {/* 桌面上的笔记本 */}
            <rect x="-13" y="31" width="26" height="15" rx="2" fill="var(--color-ink-2)" stroke="var(--paper-line)" strokeWidth="0.8" />
            <line x1="-9" y1="36" x2="6" y2="36" stroke="var(--color-fog)" strokeWidth="1.2" />
            <line x1="-9" y1="40" x2="2" y2="40" stroke="var(--color-fog)" strokeWidth="1.2" />
          </>
        )}

        {/* 名字：先沿局部 -y 推到桌外，再反旋转保持水平 */}
        {!empty && (
          <g transform={`translate(0 -35) rotate(${-angle})`}>
            <text
              textAnchor="middle"
              fontSize="12.5"
              fontWeight="600"
              fill="var(--color-fg)"
              stroke="var(--color-ink)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {mine ? '我' : name}
            </text>
          </g>
        )}

        <rect className="seat-hit" x="-24" y="-24" width="48" height="56" fill="transparent" />
      </g>
    </g>
  )
}
