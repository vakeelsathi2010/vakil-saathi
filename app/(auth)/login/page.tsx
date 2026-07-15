'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, Eye, EyeOff, LockKeyhole, Mail, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { ensureAdvocateProfile } from '@/lib/supabase/ensure-advocate'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/components/LanguageProvider'

function GoogleMark() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.64.39 3.19 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>
}

export default function LoginPage() {
  const { tr } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setLoginError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      const lower = error.message.toLowerCase()
      const message = lower.includes('email not confirmed')
        ? tr('Please verify your account using the email sent to your inbox.', 'कृपया अपने इनबॉक्स में भेजे गए ईमेल से खाता सत्यापित करें।')
        : lower.includes('invalid login credentials')
          ? tr('Incorrect email or password.', 'ईमेल या पासवर्ड गलत है।')
          : error.message
      setLoginError(message)
      toast.error(message)
      setLoading(false)
      return
    }
    if (!data.user) {
      const message = tr('A login session could not be created. Please try again.', 'लॉग इन सत्र नहीं बन सका। कृपया दोबारा प्रयास करें।')
      setLoginError(message)
      toast.error(message)
      setLoading(false)
      return
    }
    const { error: profileError } = await ensureAdvocateProfile(supabase, data.user)
    if (profileError) console.warn('Profile setup will be retried on dashboard:', profileError)
    await fetch('/api/guest-session', { method: 'DELETE' })
    toast.success(tr('Welcome back!', 'वापसी पर स्वागत है!'))
    window.location.assign('/dashboard')
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setLoginError('')
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) {
      const message = tr('Google sign-in could not be started. Please try again.', 'Google लॉग इन शुरू नहीं हो सका। कृपया दोबारा प्रयास करें।')
      setLoginError(message)
      toast.error(message)
      setGoogleLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error(tr('Enter your email first.', 'पहले अपना ईमेल दर्ज करें।'))
      return
    }
    setResetLoading(true)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) toast.error(error.message)
    else toast.success(tr('Password reset link sent. Check your inbox.', 'पासवर्ड रीसेट लिंक भेज दिया गया है। अपना इनबॉक्स देखें।'))
    setResetLoading(false)
  }

  async function handleGuestLogin() {
    localStorage.removeItem('vakil_guest_cases')
    localStorage.removeItem('vakil_guest_manual_whatsapp_reminders')
    sessionStorage.clear()
    setLoading(true)
    const response = await fetch('/api/guest-session', { method: 'POST' })
    if (!response.ok) {
      toast.error(tr('Guest mode could not be started. Please try again.', 'अतिथि मोड शुरू नहीं हो सका। कृपया दोबारा प्रयास करें।'))
      setLoading(false)
      return
    }
    window.location.assign('/dashboard')
  }

  const busy = loading || googleLoading
  return <main className="relative min-h-screen overflow-hidden bg-[#f6f5f2] text-[#171717]">
    <div className="pointer-events-none absolute -left-40 -top-52 h-[520px] w-[520px] rounded-full bg-[#ff7a3d]/15 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-64 -right-48 h-[620px] w-[620px] rounded-full bg-[#ff9c6b]/20 blur-3xl" />

    <div className="relative mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.05fr_.95fr]">
      <section className="hidden min-h-screen flex-col justify-between px-12 py-10 lg:flex xl:px-20 xl:py-14">
        <Link href="/" className="flex w-fit items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff7438] text-white shadow-lg shadow-orange-200"><Scale className="h-6 w-6" /></span><span className="text-xl font-extrabold tracking-tight">VakilSaathi</span></Link>
        <div className="max-w-xl pb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3.5 py-2 text-xs font-bold text-[#de5b20] shadow-sm"><Check className="h-4 w-4" /> {tr('Built for independent advocates', 'स्वतंत्र अधिवक्ताओं के लिए निर्मित')}</span>
          <h1 className="mt-7 text-5xl font-extrabold leading-[1.08] tracking-[-0.045em] text-[#151515] xl:text-6xl">{tr('Your cases. Your dates.', 'आपके केस। आपकी तारीखें।')}<span className="block text-[#ff7438]">{tr('Always organised.', 'हमेशा व्यवस्थित।')}</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-gray-600">{tr('A focused legal practice workspace for case reports, clients, hearings and reminders—without the paperwork chaos.', 'केस रिपोर्ट, मुवक्किल, सुनवाई और रिमाइंडर के लिए एक व्यवस्थित कानूनी कार्यक्षेत्र—कागज़ी अव्यवस्था के बिना।')}</p>
          <div className="mt-9 grid max-w-lg grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white bg-white/80 p-5 shadow-sm"><BriefcaseBusiness className="h-6 w-6 text-[#ff7438]" /><p className="mt-3 text-sm font-bold">{tr('Complete case reports', 'संपूर्ण केस रिपोर्ट')}</p><p className="mt-1 text-xs leading-5 text-gray-500">{tr('Case details and history in one place', 'केस विवरण और इतिहास एक स्थान पर')}</p></div>
            <div className="rounded-2xl border border-white bg-white/80 p-5 shadow-sm"><CalendarDays className="h-6 w-6 text-[#ff7438]" /><p className="mt-3 text-sm font-bold">{tr('Never miss a hearing', 'कोई सुनवाई न चूकें')}</p><p className="mt-1 text-xs leading-5 text-gray-500">{tr('Today and tomorrow cause lists', 'आज और कल की केस सूची')}</p></div>
          </div>
        </div>
        <p className="text-xs text-gray-400">© 2026 VakilSaathi · {tr('Secure practice management', 'सुरक्षित प्रैक्टिस प्रबंधन')}</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-8 lg:bg-white/55 lg:px-12">
        <div className="w-full max-w-[450px] rounded-[30px] border border-white bg-white px-6 py-7 shadow-[0_26px_80px_rgba(31,25,20,.12)] sm:px-10 sm:py-10 lg:rounded-[34px]">
          <div className="mb-8 flex items-center justify-between lg:justify-end">
            <Link href="/" className="flex items-center gap-2 lg:hidden"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff7438] text-white"><Scale className="h-5 w-5" /></span><span className="font-extrabold">VakilSaathi</span></Link>
            <LanguageToggle compact />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff7438]">{tr('Welcome back', 'वापसी पर स्वागत है')}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">{tr('Sign in to your account', 'अपने खाते में लॉग इन करें')}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">{tr('Continue managing your cases and hearing schedule.', 'अपने केस और सुनवाई कार्यक्रम का प्रबंधन जारी रखें।')}</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div><label htmlFor="email" className="mb-2 block text-sm font-semibold">{tr('Email address', 'ईमेल पता')}</label><div className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required placeholder={tr('advocate@example.com', 'advocate@example.com')} className="h-14 w-full rounded-xl border border-gray-200 bg-[#fafafa] pl-12 pr-4 text-sm outline-none transition focus:border-[#ff7438] focus:bg-white focus:ring-4 focus:ring-orange-100"/></div></div>
            <div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-semibold">{tr('Password', 'पासवर्ड')}</label><button type="button" disabled={resetLoading} onClick={handleForgotPassword} className="text-xs font-semibold text-[#e96429] hover:underline disabled:opacity-50">{resetLoading ? tr('Sending...', 'भेजा जा रहा है...') : tr('Forgot password?', 'पासवर्ड भूल गए?')}</button></div><div className="relative"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/><input id="password" type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required placeholder={tr('Enter your password', 'अपना पासवर्ड दर्ज करें')} className="h-14 w-full rounded-xl border border-gray-200 bg-[#fafafa] pl-12 pr-12 text-sm outline-none transition focus:border-[#ff7438] focus:bg-white focus:ring-4 focus:ring-orange-100"/><button type="button" onClick={()=>setShowPass(v=>!v)} aria-label={showPass?tr('Hide password','पासवर्ड छिपाएँ'):tr('Show password','पासवर्ड दिखाएँ')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">{showPass?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}</button></div></div>
            {loginError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{loginError}</div>}
            <button type="submit" disabled={busy} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#ff7438] font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#f2672c] disabled:cursor-not-allowed disabled:opacity-60">{loading?tr('Signing in...','लॉग इन हो रहा है...'):tr('Sign In','लॉग इन करें')} {!loading&&<ArrowRight className="h-4 w-4"/>}</button>
          </form>

          <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-gray-200"/><span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{tr('or continue with', 'या इसके साथ जारी रखें')}</span><span className="h-px flex-1 bg-gray-200"/></div>
          <button type="button" onClick={handleGoogleLogin} disabled={busy} className="flex h-13 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60"><GoogleMark />{googleLoading?tr('Connecting...','कनेक्ट हो रहा है...'):tr('Continue with Google','Google से जारी रखें')}</button>
          <button type="button" onClick={handleGuestLogin} disabled={busy} className="mt-3 h-12 w-full rounded-xl text-sm font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 disabled:opacity-60">{tr('Explore as Guest', 'अतिथि के रूप में देखें')}</button>
          <p className="mt-7 text-center text-sm text-gray-500">{tr("Don't have an account?", 'खाता नहीं है?')} <Link href="/register" className="font-bold text-[#e96429] hover:underline">{tr('Create account', 'खाता बनाएँ')}</Link></p>
          <p className="mt-5 text-center text-[11px] leading-5 text-gray-400">{tr('By continuing, you agree to our', 'जारी रखकर आप हमारी')} <Link href="/terms" className="font-semibold text-gray-600 underline underline-offset-2">{tr('Terms & Privacy Policy', 'सेवा की शर्तों और गोपनीयता नीति')}</Link>{tr('.', ' से सहमत होते हैं।')}</p>
        </div>
      </section>
    </div>
  </main>
}
