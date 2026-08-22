import { useRef } from 'react'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/gsap'
import { Typewriter } from './Typewriter'
import { ArrowRight, CalendarDays, MapPin, Users } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

type Props = {
  onStart: () => void
  entryText: string
  stats: { tables: number; seats: number; left: number }
}

export function Cover({ onStart, entryText, stats }: Props) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const reduce = prefersReducedMotion()
      // 一律用 fromTo：终点值写死，动画即使被打断也不会把元素留在 opacity:0
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.5 } })
      tl.fromTo('.cv-mark', { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.6 })
        .fromTo('.cv-kicker', { opacity: 0, x: -20 }, { opacity: 1, x: 0 }, '-=0.3')
        .fromTo('.cv-title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.25')
        .fromTo('.cv-meta > *', { opacity: 0, y: 18 }, { opacity: 1, y: 0, stagger: 0.08 }, '-=0.35')
        .fromTo('.cv-stat', { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, '-=0.25')
        .fromTo('.cv-cta', { opacity: 0, y: 24 }, { opacity: 1, y: 0 }, '-=0.2')

      if (reduce) return

      // 光晕缓慢漂移，桌面端再叠一层鼠标视差
      const mm = gsap.matchMedia()
      mm.add('(min-width: 900px)', () => {
        const layers = gsap.utils.toArray<HTMLElement>('.cv-parallax')
        const setters = layers.map((el) => ({
          el,
          xTo: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' }),
          yTo: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' }),
          depth: Number(el.dataset.depth || 1),
        }))
        const onMove = (e: MouseEvent) => {
          const dx = e.clientX / window.innerWidth - 0.5
          const dy = e.clientY / window.innerHeight - 0.5
          setters.forEach((s) => {
            s.xTo(-dx * 26 * s.depth)
            s.yTo(-dy * 18 * s.depth)
          })
        }
        window.addEventListener('mousemove', onMove)
        return () => window.removeEventListener('mousemove', onMove)
      })
    },
    { scope: root },
  )

  return (
    <div ref={root} className="bg-aurora relative min-h-dvh overflow-hidden">

      <div className="relative mx-auto flex min-h-dvh max-w-2xl flex-col px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-7">
        <div className="cv-mark flex items-center justify-between">
          <img src="/openfde-wordmark.png" alt="OpenFDE" className="h-7 opacity-95 invert dark:invert-0" />
          <div className="flex items-center gap-2">
            <span className="rule-alert px-3 py-1 font-mono text-[11px] tracking-[0.18em] text-[var(--alert)]">
              2026.08.22
            </span>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-6">
          <div className="cv-kicker flex items-center gap-2.5 font-mono text-[13px] font-bold tracking-[.18em] text-cyan">
            <i className="h-px w-7 bg-cyan" />
            FDEC 2026
          </div>

          <h1 className="cv-title cv-parallax mt-4 text-[clamp(42px,12vw,76px)] font-black leading-[0.98] tracking-tight" data-depth="1.4">
            前沿部署
            <br />
            <span className="grad-fde">工程师大会</span>
          </h1>

          <div className="cv-meta mt-7 space-y-2.5 text-[15px] text-fog">
            <p className="flex items-center gap-2.5">
              <MapPin className="size-4 text-cyan" />
              杭州市余杭区湖畔良仓 21 号楼会议室
            </p>
            <p className="flex items-center gap-2.5">
              <CalendarDays className="size-4 text-violet" />
              2026 年 8 月 22 日（周六）13:00 – 18:30
            </p>
            <p className="flex items-center gap-2.5">
              <Users className="size-4 text-magenta" />
              {stats.tables} 张会议桌 · {stats.tables} 个话题 · {stats.seats} 位工程师
            </p>
          </div>

          <div className="mt-8 border-l-2 border-[var(--alert)] bg-ink-2/60 px-4 py-3 text-[13.5px] text-fg/85">
            <Typewriter
              lines={[
                '正在载入会场平面图...',
                '选一张桌子，选一个位置，认识 9 个同行。',
                '连接前沿，部署未来。',
              ]}
            />
          </div>
        </div>

        <div className="cv-stat grid grid-cols-3 border-y border-[var(--hairline)]">
          {[
            { v: stats.tables, l: '话题桌数' },
            { v: stats.seats, l: '开放座位' },
            { v: stats.left, l: '尚有空位' },
          ].map((s) => (
            <div key={s.l} className="border-r border-[var(--hairline)] px-2 py-4 last:border-r-0">
              <strong className="block text-[26px] font-black leading-none">{s.v}</strong>
              <span className="mt-1.5 block text-[11px] tracking-wider text-fog">{s.l}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="cv-cta mt-6 flex h-14 w-full items-center justify-between bg-fg px-5 text-base font-bold text-ink transition hover:opacity-90"
        >
          {entryText}
          <span className="grid size-8 place-items-center bg-ink text-fg">
            <ArrowRight className="size-4" />
          </span>
        </button>
        <p className="mt-3 text-center text-[11px] text-fog/80">仅限已报名参会者 · 一人一座，可随时更换</p>
      </div>
    </div>
  )
}
