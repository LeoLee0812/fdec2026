import { useRef, useState } from 'react'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/gsap'
import { cn } from '@/lib/utils'

/** 两套主题的色值，必须与 index.css 里 .dark / html:not(.dark) 的定义保持一致 */
const THEME = {
  dark: {
    '--color-ink': '#05060a',
    '--color-ink-2': '#0b0d14',
    '--color-panel': '#11141d',
    '--color-line': '#232838',
    '--color-fog': '#8b93a7',
    '--color-fg': '#e8ecf5',
  },
  light: {
    '--color-ink': '#eef1f6',
    '--color-ink-2': '#ffffff',
    '--color-panel': '#ffffff',
    '--color-line': '#dde2ec',
    '--color-fog': '#66708a',
    '--color-fg': '#10131b',
  },
} as const

export type ThemeName = keyof typeof THEME

export function readTheme(): ThemeName {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** 点击点到屏幕最远角的距离，作为圆形遮罩的终止半径 */
function maxRadius(x: number, y: number) {
  return Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
}

export function ThemeToggle({ className }: { className?: string }) {
  const root = useRef<HTMLButtonElement>(null)
  const [isDark, setIsDark] = useState(readTheme() === 'dark')
  const busy = useRef(false)

  // 图标初始态：暗色显示月亮（光线收起、遮罩圆进入裁出弯月）
  useGSAP(
    () => {
      const dark = readTheme() === 'dark'
      gsap.set('.tt-rays', { opacity: dark ? 0 : 1, scale: dark ? 0.4 : 1, transformOrigin: '50% 50%' })
      gsap.set('.tt-mask-circle', { attr: { cx: dark ? 18 : 30 } })
    },
    { scope: root },
  )

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    if (busy.current) return
    busy.current = true

    const next: ThemeName = isDark ? 'light' : 'dark'
    setIsDark(next === 'dark')
    localStorage.setItem('fdec-theme', next)

    const html = document.documentElement
    const from = THEME[isDark ? 'dark' : 'light']
    const to = THEME[next]
    const reduce = prefersReducedMotion()

    const swapClass = () => html.classList.toggle('dark', next === 'dark')

    if (reduce) {
      swapClass()
      busy.current = false
      return
    }

    // 先把当前色写成内联值定住，再换 class —— 这样 class 切换的瞬间画面不会跳
    Object.entries(from).forEach(([k, v]) => html.style.setProperty(k, v))
    swapClass()

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX || rect.left + rect.width / 2
    const y = e.clientY || rect.top + rect.height / 2

    // 圆形遮罩用目标背景色，从点击点扩散盖住全屏
    const ripple = document.createElement('div')
    ripple.id = 'theme-ripple'
    ripple.style.background = to['--color-ink']
    document.body.appendChild(ripple)

    gsap.fromTo(
      ripple,
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      {
        clipPath: `circle(${maxRadius(x, y)}px at ${x}px ${y}px)`,
        duration: 0.7,
        ease: 'power2.inOut',
        onComplete: () => {
          // 内联值使命完成，清掉交回 class 接管，再撤走遮罩
          Object.keys(to).forEach((k) => html.style.removeProperty(k))
          gsap.to(ripple, { opacity: 0, duration: 0.18, onComplete: () => ripple.remove() })
          busy.current = false
        },
      },
    )

    // 页面真实颜色同步补间，遮罩没盖到的边缘也是平滑过渡
    gsap.to(html, { duration: 0.7, ease: 'power2.inOut', ...to })

    // 图标：整体转半圈，光线收放，遮罩圆进出裁出弯月/满圆
    const tl = gsap.timeline()
    tl.to('.tt-icon', { rotation: '+=180', duration: 0.7, ease: 'back.inOut(1.4)', transformOrigin: '50% 50%' }, 0)
    if (next === 'dark') {
      tl.to('.tt-rays', { opacity: 0, scale: 0.4, duration: 0.4, ease: 'power2.in' }, 0).to(
        '.tt-mask-circle',
        { attr: { cx: 18 }, duration: 0.5, ease: 'power2.inOut' },
        0.15,
      )
    } else {
      tl.to('.tt-mask-circle', { attr: { cx: 30 }, duration: 0.4, ease: 'power2.inOut' }, 0).to(
        '.tt-rays',
        { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' },
        0.2,
      )
    }
  }

  const maskId = 'tt-moon-mask'

  return (
    <button
      ref={root}
      onClick={toggle}
      aria-label={isDark ? '切换到亮色主题' : '切换到暗色主题'}
      title={isDark ? '切换到亮色主题' : '切换到暗色主题'}
      className={cn(
        'grid size-8 place-items-center rounded-lg border border-line text-cyan transition hover:bg-cyan/10',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="tt-icon size-[18px] overflow-visible" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="white" />
          {/* 这个偏移圆遮住主圆右上角形成弯月，移出视野就变回满圆 */}
          <circle className="tt-mask-circle" cx="18" cy="10" r="6" fill="black" />
        </mask>
        <circle cx="12" cy="12" r="6" mask={`url(#${maskId})`} />
        <g className="tt-rays">
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="3.5" y1="3.5" x2="5" y2="5" />
          <line x1="19" y1="19" x2="20.5" y2="20.5" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="3.5" y1="20.5" x2="5" y2="19" />
          <line x1="19" y1="5" x2="20.5" y2="3.5" />
        </g>
      </svg>
    </button>
  )
}
