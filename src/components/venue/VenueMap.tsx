import { useRef } from 'react'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/gsap'
import { ACCENT, type Topic } from '@/lib/api'
import { Check } from 'lucide-react'

type Props = {
  topics: Topic[]
  myTopicId?: number
  onOpen: (topic: Topic) => void
}

/**
 * 全场平面图：桌子用一张俯视素材图重复摆放（比 SVG 画的干净好看），
 * 桌号、余位、我的桌高亮这些状态再叠在图上。舞台在上、签到处在下，与现场摆位一致。
 */
export function VenueMap({ topics, myTopicId, onOpen }: Props) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const reduce = prefersReducedMotion()
      if (reduce) {
        gsap.fromTo('.vm-table', { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.01 })
        return
      }
      gsap.fromTo('.vm-stage', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' })
      // 从场地中心往外一圈圈亮起来
      gsap.fromTo(
        '.vm-table',
        { opacity: 0, scale: 0.72 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          ease: 'back.out(1.6)',
          stagger: { each: 0.04, from: 'center', grid: 'auto' },
        },
      )
      gsap.fromTo('.vm-foot', { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.6 })
    },
    { scope: root, dependencies: [topics.length, myTopicId], revertOnUpdate: true },
  )

  return (
    <div ref={root} className="mx-auto max-w-4xl px-1 py-2">
      {/* 舞台 */}
      <div className="vm-stage mx-auto mb-5 max-w-lg rounded-2xl border border-cyan/35 bg-gradient-to-b from-cyan/12 to-transparent px-4 py-3 text-center sm:mb-8 sm:px-6 sm:py-4">
        <p className="text-[15px] font-black tracking-[0.28em] text-cyan text-glow sm:text-[17px]">舞台 / 主讲区</p>
        <p className="mt-1 text-[10.5px] tracking-widest text-fog sm:text-[11.5px]">FDEC 2026 · 湖畔良仓 21 号楼</p>
      </div>

      {/* 20 张桌子 */}
      {/* 固定 4 列 × 5 行，和现场摆位一一对应，手机上也不改列数（改了就不是「平面图」了） */}
      <div className="grid grid-cols-4 gap-x-1.5 gap-y-3 sm:gap-x-5 sm:gap-y-6">
        {topics.map((t) => {
          const a = ACCENT[t.accent]
          const left = t.capacity - t.taken.length
          const full = left <= 0
          const mine = t.id === myTopicId

          return (
            <button
              key={t.id}
              onClick={() => onOpen(t)}
              title={t.title}
              className="vm-table group relative flex flex-col items-center outline-none"
            >
              <div className="relative w-full">
                {mine && (
                  <div
                    className="pointer-events-none absolute inset-[6%] animate-pulse rounded-full blur-xl"
                    style={{ background: a.main, opacity: 0.28 }}
                  />
                )}
                <img
                  src="/table-top.png"
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="relative w-full select-none transition duration-300 group-hover:scale-[1.04] [mask-image:radial-gradient(circle_at_50%_50%,#000_60%,transparent_74%)]"
                  style={{
                    filter: full
                      ? 'grayscale(1) brightness(0.55)'
                      : `hue-rotate(${HUE[t.accent]}deg) saturate(1.05)`,
                    opacity: full ? 0.6 : 1,
                  }}
                />
                {/* 桌号叠在桌面中央 */}
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span
                    className="grid size-[38%] place-items-center rounded-full font-mono text-[clamp(15px,4.6vw,28px)] font-black leading-none backdrop-blur-[2px]"
                    style={{
                      color: full ? '#7d859b' : '#fff',
                      background: 'rgba(5,6,10,.55)',
                      boxShadow: `0 0 20px ${full ? 'transparent' : a.soft}`,
                    }}
                  >
                    {String(t.table_no).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* 状态徽章 */}
              <span
                className="-mt-1.5 flex items-center gap-0.5 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold sm:-mt-2 sm:gap-1 sm:px-2.5 sm:py-1 sm:text-[11.5px]"
                style={{
                  borderColor: mine ? a.main : full ? '#2a3040' : `${a.main}55`,
                  color: mine ? a.main : full ? '#6b7285' : '#c3cad9',
                  background: mine ? a.soft : 'rgba(5,6,10,.75)',
                }}
              >
                {mine && <Check className="size-2.5 sm:size-3" />}
                {mine ? '我的桌' : full ? '坐满' : `余 ${left}`}
              </span>

              {/* 手机上不显示话题名，靠桌号认位；想看话题去「列表」页 */}
              <p className="mt-2 hidden line-clamp-2 px-1 text-center text-[12px] leading-snug text-fog transition group-hover:text-white/85 sm:block">
                {t.title}
              </p>
            </button>
          )
        })}
      </div>

      <div className="vm-foot mx-auto mt-8 max-w-xs rounded-xl border border-line bg-panel/70 py-2.5 text-center text-[12px] tracking-widest text-fog">
        入口 / 签到处
      </div>
    </div>
  )
}

/** 素材本身是青色的，用色相旋转把每张桌子拉开区分度 */
const HUE: Record<string, number> = { cyan: 0, violet: 42, magenta: 86, amber: 155 }
