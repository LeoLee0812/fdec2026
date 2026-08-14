import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Flip } from 'gsap/Flip'
import { TextPlugin } from 'gsap/TextPlugin'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { CustomEase } from 'gsap/CustomEase'
import { CustomBounce } from 'gsap/CustomBounce'
import { CustomWiggle } from 'gsap/CustomWiggle'
import { Physics2DPlugin } from 'gsap/Physics2DPlugin'

// GSAP 3.13 起全套插件免费，直接从 npm 公共源注册即可
gsap.registerPlugin(useGSAP, Flip, TextPlugin, DrawSVGPlugin, CustomEase, CustomBounce, CustomWiggle, Physics2DPlugin)

// 落座弹跳 / 座位被占时摇头，各注册一条自定义缓动
CustomBounce.create('seatDrop', { strength: 0.58, squash: 2, squashID: 'seatDrop-squash' })
CustomWiggle.create('seatDeny', { wiggles: 6, type: 'easeOut' })

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { gsap, useGSAP, Flip }
