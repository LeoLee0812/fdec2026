import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { cn } from '@/lib/utils'

type Props = {
  lines: string[]
  /** 每个字符的耗时，越小打得越快 */
  speed?: number
  /** 打完一句停留多久 */
  hold?: number
  /** false 时打完最后一句就停住不删除 */
  loop?: boolean
  prompt?: string
  className?: string
  onDone?: () => void
}

/**
 * TextPlugin 打字机。delimiter 必须是空字符串，否则中文会按「词」整块蹦出来。
 * 文本节点交给 GSAP 托管（React 不往里渲染子节点），避免和 VDOM 抢 innerHTML。
 */
export function Typewriter({
  lines,
  speed = 0.055,
  hold = 1.1,
  loop = true,
  prompt = '>',
  className,
  onDone,
}: Props) {
  const root = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      gsap.to('.tw-cursor', { opacity: 0, duration: 0.5, repeat: -1, yoyo: true, ease: 'steps(1)' })

      const tl = gsap.timeline({ repeat: loop ? -1 : 0, onComplete: onDone })
      lines.forEach((line, i) => {
        tl.to('.tw-text', {
          duration: line.length * speed,
          text: { value: line, delimiter: '' },
          ease: 'none',
        }).to({}, { duration: hold })
        // 不循环时，最后一句打完就留在屏幕上
        if (loop || i < lines.length - 1) {
          tl.to('.tw-text', { duration: 0.35, text: { value: '', delimiter: '' }, ease: 'none' })
        }
      })
    },
    { scope: root, dependencies: [lines.join('|')], revertOnUpdate: true },
  )

  return (
    <span ref={root} className={cn('font-mono inline-flex items-center gap-1.5', className)}>
      {prompt && <span className="text-lime">{prompt}</span>}
      <span className="tw-text" />
      <span className="tw-cursor inline-block h-[1.05em] w-[0.5em] translate-y-[0.1em] bg-lime" />
    </span>
  )
}
