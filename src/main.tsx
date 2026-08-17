import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { Toaster } from '@/components/ui/sonner'
import '@/lib/gsap'
import './index.css'
import App from './App.tsx'

// 不套 StrictMode：双挂载会让 GSAP 的 from 动画卡在初始状态（元素停在 opacity:0）
createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <Toaster position="top-center" theme="dark" />
    {/* Vercel Web Analytics：统计访客与页面浏览，不采集个人身份信息 */}
    <Analytics />
  </>,
)
