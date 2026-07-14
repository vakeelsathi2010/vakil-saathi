'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, LockKeyhole, Mail, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { ensureAdvocateProfile } from '@/lib/supabase/ensure-advocate'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/components/LanguageProvider'

export default function LoginPage() {
  const { isHindi } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLoginError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const isUnconfirmed = error.message
        .toLowerCase()
        .includes('email not confirmed')
      const message = isUnconfirmed
          ? 'Pehle apne email inbox se account verify karein'
          : error.message === 'Invalid login credentials'
          ? 'Email ya password galat hai'
          : error.message
      setLoginError(message)
      toast.error(message)
      setLoading(false)
      return
    }

    if (!data.user) {
      const message = 'Login session nahi bani. Dobara login karein.'
      setLoginError(message)
      toast.error(message)
      setLoading(false)
      return
    }

    const { error: profileError } = await ensureAdvocateProfile(
      supabase,
      data.user
    )
    if (profileError) {
      // Authentication has succeeded. The dashboard retries profile creation,
      // so a profile error must not trap a valid user on the login page.
      console.warn('Profile setup will be retried on dashboard:', profileError)
    }

    await fetch('/api/guest-session', { method: 'DELETE' })
    toast.success('Login ho gaya!')
    window.location.assign('/dashboard')
  }

  async function handleGuestLogin() {
    // Guest access lasts only for the current browser session. Each new guest
    // login starts with a completely empty workspace.
    localStorage.removeItem('vakil_guest_cases')
    localStorage.removeItem('vakil_guest_manual_whatsapp_reminders')
    sessionStorage.clear()
    setLoading(true)
    const response = await fetch('/api/guest-session', { method: 'POST' })
    if (!response.ok) {
      toast.error('Guest mode start nahi hua. Dobara try karein.')
      setLoading(false)
      return
    }
    toast.success('Guest mode mein swagat hai')
    window.location.assign('/dashboard')
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#17104b] px-4 py-8 sm:px-6 sm:py-12">
      <div className="absolute right-4 top-4 z-20 text-white sm:right-6 sm:top-6"><LanguageToggle /></div>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-20 h-80 w-80 rounded-full bg-[#1498ff] opacity-90 blur-[90px]" />
        <div className="absolute right-[-7rem] top-[8%] h-96 w-96 rounded-full bg-[#ed43d2] opacity-80 blur-[100px]" />
        <div className="absolute bottom-[-8rem] left-[18%] h-96 w-96 rounded-full bg-[#5538ff] opacity-90 blur-[100px]" />
        <div className="absolute bottom-[-6rem] right-[-3rem] h-72 w-72 rounded-full bg-[#ff2f98] opacity-70 blur-[90px]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_40%,rgba(255,255,255,0.04))]" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col items-center justify-center sm:min-h-[calc(100vh-6rem)]">
        <div className="mb-7 text-center text-white sm:mb-9">
          <div className="mb-2 flex items-center justify-center gap-2.5">
            <Scale className="h-9 w-9" strokeWidth={2.2} />
            <span className="text-3xl font-bold tracking-tight">VakilSaathi</span>
          </div>
          <p className="text-sm font-medium text-white/75">{isHindi ? 'अधिवक्ता का डिजिटल साथी' : 'Your digital legal practice companion'}</p>
        </div>

        <div className="w-full rounded-[2rem] border border-white/70 bg-white/95 px-6 py-8 shadow-[0_30px_80px_rgba(19,9,74,0.38)] backdrop-blur-xl sm:px-10 sm:py-10">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-[74px] w-[74px] items-center justify-center rounded-full bg-gradient-to-br from-[#f044c5] via-[#8d47ec] to-[#2d8cff] p-[3px] shadow-[0_12px_30px_rgba(124,58,237,0.35)]">
              <div className="flex h-full w-full items-center justify-center rounded-full border border-white/50 bg-white/15">
                <Scale className="h-9 w-9 text-white" strokeWidth={2.2} />
              </div>
            </div>
            <h1 className="text-[2rem] font-bold tracking-tight text-[#21153f]">{isHindi ? 'वापसी पर स्वागत है' : 'Welcome back'}</h1>
            <p className="mt-1.5 text-sm text-[#817991]">{isHindi ? 'अपने मुकदमे और पेशियाँ संभालें' : 'Manage your cases and hearing dates'}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#332a46]">
                {isHindi ? 'ईमेल' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b82a0]" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isHindi ? 'अपना ईमेल दर्ज करें' : 'Enter your email'}
                  autoComplete="email"
                  required
                  className="h-14 w-full rounded-xl border border-[#e4dfed] bg-white pl-12 pr-4 text-[#211a30] shadow-[0_7px_18px_rgba(63,41,104,0.10)] transition placeholder:text-[#aaa3b7] focus:border-[#7c4df1] focus:ring-4 focus:ring-[#7c4df1]/10"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <label htmlFor="password" className="text-sm font-semibold text-[#332a46]">
                  {isHindi ? 'पासवर्ड' : 'Password'}
                </label>
                <span className="text-xs font-medium text-[#7556bd]">{isHindi ? 'पासवर्ड भूल गए?' : 'Forgot password?'}</span>
              </div>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b82a0]" />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isHindi ? 'अपना पासवर्ड दर्ज करें' : 'Enter your password'}
                  autoComplete="current-password"
                  required
                  className="h-14 w-full rounded-xl border border-[#e4dfed] bg-white pl-12 pr-12 text-[#211a30] shadow-[0_7px_18px_rgba(63,41,104,0.10)] transition placeholder:text-[#aaa3b7] focus:border-[#7c4df1] focus:ring-4 focus:ring-[#7c4df1]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((current) => !current)}
                  aria-label={showPass ? 'Password chhupayein' : 'Password dikhayein'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8b82a0] transition hover:bg-[#f3effb] hover:text-[#5f3dba]"
                >
                  {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-14 w-full rounded-xl bg-gradient-to-r from-[#ee42bd] via-[#9a45eb] to-[#276eea] text-base font-bold text-white shadow-[0_12px_28px_rgba(111,65,225,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(111,65,225,0.42)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading ? (isHindi ? 'लॉग इन हो रहा है...' : 'Logging in...') : (isHindi ? 'लॉग इन करें' : 'Log In')}
            </button>

            <button
              type="button"
              onClick={handleGuestLogin}
              className="h-14 w-full rounded-xl border-2 border-[#7c4df1]/25 bg-[#f8f5ff] text-base font-bold text-[#6544bd] transition hover:border-[#7c4df1]/45 hover:bg-[#f2ecff]"
            >
              {isHindi ? 'गेस्ट के रूप में प्रवेश करें' : 'Login as Guest'}
            </button>

            {loginError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {loginError}
              </div>
            )}
          </form>

          <div className="my-7 flex items-center gap-3 text-xs text-[#948da0]">
            <span className="h-px flex-1 bg-[#e6e1ec]" />
            <span>{isHindi ? 'VakilSaathi में सुरक्षित लॉग इन' : 'Secure login to VakilSaathi'}</span>
            <span className="h-px flex-1 bg-[#e6e1ec]" />
          </div>

          <p className="text-center text-sm text-[#716a7d]">
            {isHindi ? 'नए हैं?' : 'New here?'}{' '}
            <Link href="/register" className="font-bold text-[#6949c6] transition hover:text-[#e23bb5]">
              {isHindi ? 'मुफ़्त अकाउंट बनाएँ →' : 'Create a free account →'}
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-white/65">
          Login karke aap hamari{' '}
          <Link href="/terms" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
            Terms &amp; Privacy Policy
          </Link>{' '}
          se sahmat hain
        </p>
      </section>
    </main>
  )
}
