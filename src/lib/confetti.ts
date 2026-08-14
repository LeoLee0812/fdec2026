import { gsap, prefersReducedMotion } from './gsap'

const COLORS = ['#38e1ff', '#8b5cff', '#ff4fd8', '#ffb638', '#58e6a8']

/** 选座成功时从屏幕中上方撒一把彩带，Physics2D 负责抛物线 */
export function confettiBurst(x = window.innerWidth / 2, y = window.innerHeight * 0.36) {
  if (prefersReducedMotion()) return
  const layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:80'
  document.body.appendChild(layer)

  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i')
    const size = 5 + Math.random() * 7
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size * 1.6}px;border-radius:2px;background:${
      COLORS[i % COLORS.length]
    };will-change:transform`
    layer.appendChild(p)
    gsap.to(p, {
      duration: 1.1 + Math.random() * 0.9,
      physics2D: { velocity: 320 + Math.random() * 420, angle: -90 + (Math.random() * 120 - 60), gravity: 900 },
      rotation: Math.random() * 720 - 360,
      opacity: 0,
      ease: 'none',
    })
  }
  gsap.delayedCall(2.4, () => layer.remove())
}
