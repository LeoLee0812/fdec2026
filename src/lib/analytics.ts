import { track as vercelTrack } from '@vercel/analytics'

// 同一份构建同时跑在 Vercel（openfde.net）和 Cloudflare Workers（openfde.online）上，
// 而 /_vercel/insights/* 只有 Vercel 侧才有：CF 那边 SPA 回退会把 index.html 当成脚本
// 或事件接口返回，控制台必报错。所以统计只在 Vercel 域下启用。
export const analyticsEnabled =
  typeof location !== 'undefined' && location.hostname.endsWith('openfde.net')

/** 上报自定义事件；非 Vercel 域下直接跳过，不产生任何请求 */
export function track(...args: Parameters<typeof vercelTrack>) {
  if (analyticsEnabled) vercelTrack(...args)
}
