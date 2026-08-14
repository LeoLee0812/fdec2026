import { avatarOf } from '@/lib/avatar'
import { ACCENT, type AccentKey } from '@/lib/api'

type Props = {
  seatNo: number
  angle: number
  x: number
  y: number
  name?: string
  mine?: boolean
  isOwner?: boolean
  accent: AccentKey
  onClick?: () => void
}

/**
 * 单个座位的俯视小人。
 * 局部坐标约定：原点是座位中心，+y 指向桌心，所以整组只要 rotate(角度) 就能自动朝向桌子。
 * 头像里的文字要再 rotate(-角度) 转回来，否则侧面和下方的名字会倒着写。
 */
export function SeatPerson({ seatNo, angle, x, y, name, mine, isOwner, accent, onClick }: Props) {
  const a = ACCENT[accent]
  const empty = !name

  // 定位（translate/rotate）放在外层 <g>，动画只作用于没有 transform 的内层，
  // 否则 GSAP 改写 transform 矩阵时会把定位一起吃掉，小人全跑到画布左上角
  if (empty) {
    return (
      <g transform={`translate(${x} ${y})`}>
        <g className="seat-node seat-empty cursor-pointer" data-seat={seatNo} onClick={onClick}>
          <circle
            r="26"
            fill="rgba(255,255,255,.02)"
            stroke={a.main}
            strokeOpacity="0.5"
            strokeWidth="1.6"
            strokeDasharray="5 6"
          />
          <circle className="seat-hit" r="30" fill="transparent" />
          <text textAnchor="middle" y="4" fontSize="13" fill={a.main} fillOpacity="0.85">
            空位
          </text>
        </g>
      </g>
    )
  }

  const av = avatarOf(name!)
  const gid = `av-${accent}-${seatNo}`

  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <g className={`seat-node seat-taken${mine ? ' seat-mine' : ''}`} data-seat={seatNo} onClick={onClick}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={av.from} />
          <stop offset="100%" stopColor={av.to} />
        </linearGradient>
      </defs>

      {/* 椅背：在人的身后向外凸 */}
      <path
        d="M-27,-4 A 27 27 0 0 1 27,-4"
        fill="none"
        stroke={a.main}
        strokeOpacity={mine ? 0.95 : 0.5}
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* 身体 */}
      <ellipse cx="0" cy="6" rx="23" ry="19" fill={a.deep} stroke={a.main} strokeOpacity="0.55" strokeWidth="1.2" />

      {/* 两只手伸向笔记本 */}
      <path d="M-15,16 Q -13,26 -9,30" fill="none" stroke={a.main} strokeOpacity="0.65" strokeWidth="3" strokeLinecap="round" />
      <path d="M15,16 Q 13,26 9,30" fill="none" stroke={a.main} strokeOpacity="0.65" strokeWidth="3" strokeLinecap="round" />

      {/* 笔记本：靠桌心那侧，屏幕上跑三行代码 */}
      <g className="seat-laptop">
        <rect x="-19" y="28" width="38" height="7" rx="2.5" fill="#20242f" stroke="#333a4c" strokeWidth="0.8" />
        <rect x="-16" y="35" width="32" height="21" rx="2.5" fill="#0b0e16" stroke={a.main} strokeOpacity="0.45" strokeWidth="1" />
        <g className="seat-code">
          <rect className="code-line" x="-13" y="39" width="18" height="2.2" rx="1.1" fill="#58e6a8" />
          <rect className="code-line" x="-13" y="44" width="24" height="2.2" rx="1.1" fill="#38e1ff" />
          <rect className="code-line" x="-13" y="49" width="13" height="2.2" rx="1.1" fill="#ff4fd8" />
        </g>
      </g>

      {/* 头像 */}
      <circle r="16" fill={`url(#${gid})`} stroke={mine ? '#fff' : av.ring} strokeOpacity={mine ? 1 : 0.55} strokeWidth={mine ? 2.4 : 1.4} />
      <g transform={`rotate(${-angle})`}>
        <text textAnchor="middle" y="5.5" fontSize="15" fontWeight="700" fill="#0b0e16">
          {av.initial}
        </text>
      </g>

      {/* 名字标签：先沿局部 -y 推到桌外（避免压住笔记本），再反旋转保持水平可读 */}
      <g transform={`translate(0 -32) rotate(${-angle})`}>
        <text textAnchor="middle" fontSize="13.5" fontWeight="600" fill={mine ? '#fff' : '#c8cfdd'}>
          {mine ? '我' : name}
        </text>
        {isOwner && (
          <text textAnchor="middle" y="-17" fontSize="10.5" fontWeight="700" fill={a.main} letterSpacing="1">
            话题发起人
          </text>
        )}
      </g>

      <circle className="seat-hit" r="30" fill="transparent" />
    </g>
    </g>
  )
}
