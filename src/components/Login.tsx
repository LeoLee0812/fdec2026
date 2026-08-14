import { useEffect, useRef, useState } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronLeft, Loader2, ShieldCheck } from 'lucide-react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; theme?: string }) => string
    }
  }
}

type Props = { onBack: () => void; onLoggedIn: () => void; siteKey: string }

export function Login({ onBack, onLoggedIn, siteKey }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const tsBox = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState({ name: '', phone: '', invite_code: '', hp: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [tsToken, setTsToken] = useState('')

  useGSAP(
    () => {
      gsap.fromTo('.lg-card', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
      gsap.fromTo(
        '.lg-field',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.07, delay: 0.15, ease: 'power2.out' },
      )
    },
    { scope: root },
  )

  // 只有配置了 sitekey 才拉 Turnstile 脚本，本地开发不受影响
  useEffect(() => {
    if (!siteKey || !tsBox.current) return
    const render = () => {
      if (window.turnstile && tsBox.current && !tsBox.current.hasChildNodes()) {
        window.turnstile.render(tsBox.current, { sitekey: siteKey, callback: setTsToken, theme: 'dark' })
      }
    }
    if (window.turnstile) return render()
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = render
    document.head.appendChild(s)
  }, [siteKey])

  async function submit() {
    setErr('')
    if (!form.name.trim()) return setErr('请填写姓名')
    if (form.phone.replace(/\D/g, '').length < 6) return setErr('请填写正确的手机号')
    if (siteKey && !tsToken) return setErr('请先完成人机校验')
    setBusy(true)
    try {
      await api.login({ ...form, turnstile: tsToken })
      onLoggedIn()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '登录失败，请重试'
      setErr(msg)
      // 登录失败时卡片摇一下头
      gsap.fromTo('.lg-card', { x: -9 }, { x: 0, duration: 0.6, ease: 'seatDeny' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={root} className="bg-aurora bg-grid relative min-h-dvh px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-5">
      <button onClick={onBack} className="flex items-center gap-1 py-2 text-sm text-fog hover:text-fg">
        <ChevronLeft className="size-4" />
        返回
      </button>

      <div className="mx-auto max-w-md">
        <div className="lg-card mt-[8vh] rounded-3xl border border-line bg-panel/90 p-6 shadow-2xl backdrop-blur">
          <span className="font-mono text-[11px] font-bold tracking-[.16em] text-cyan">STEP 01 / 身份确认</span>
          <h2 className="mt-2 text-[26px] font-black leading-tight">确认一下你是谁</h2>
          <p className="mt-2 text-[13px] text-fog">
            请填写报名时使用的姓名与手机号。不在报名名单里的临时来宾，请填写工作人员给你的邀请码。
          </p>

          <div className="mt-6 space-y-4">
            <div className="lg-field space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                value={form.name}
                maxLength={20}
                autoComplete="name"
                placeholder="请输入姓名"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-12 bg-ink-2 text-base"
              />
            </div>
            <div className="lg-field space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input
                id="phone"
                value={form.phone}
                maxLength={15}
                inputMode="tel"
                autoComplete="tel"
                placeholder="请输入手机号"
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-12 bg-ink-2 text-base"
              />
            </div>
            <div className="lg-field space-y-2">
              <Label htmlFor="code">邀请码（选填）</Label>
              <Input
                id="code"
                value={form.invite_code}
                maxLength={24}
                autoCapitalize="characters"
                placeholder="临时来宾请填写邀请码"
                onChange={(e) => setForm({ ...form, invite_code: e.target.value.toUpperCase() })}
                className="h-12 bg-ink-2 font-mono text-base tracking-widest"
              />
            </div>

            {/* 蜜罐：真人看不见，脚本会老老实实填上 */}
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              value={form.hp}
              onChange={(e) => setForm({ ...form, hp: e.target.value })}
              className="pointer-events-none absolute left-[-9999px] size-0 opacity-0"
            />

            {siteKey && <div ref={tsBox} className="lg-field flex justify-center pt-1" />}

            <Button
              onClick={submit}
              disabled={busy}
              className="lg-field h-12 w-full rounded-xl bg-gradient-to-r from-cyan to-violet text-base font-bold text-white hover:opacity-90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : '进入选座'}
            </Button>

            {err && <p className="text-center text-sm font-semibold text-magenta">{err}</p>}

            <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-fog/80">
              <ShieldCheck className="size-3.5" />
              手机号仅用于核对报名信息，不会明文存储
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
