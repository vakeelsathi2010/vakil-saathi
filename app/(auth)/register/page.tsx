'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  Landmark,
  LockKeyhole,
  Mail,
  Scale,
  User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { ensureAdvocateProfile } from '@/lib/supabase/ensure-advocate'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/components/LanguageProvider'

const COURTS = [
  'District Court, Kanpur Nagar',
  'District Court, Kanpur Dehat',
  'High Court, Allahabad',
  'High Court, Lucknow Bench',
  'Family Court, Kanpur',
  'Labour Court, Kanpur',
  'Consumer Forum, Kanpur',
  'Other',
]

const BAR_ASSOCIATIONS = [
  'Kanpur Bar Association',
  'Kanpur Dehat Bar Association',
  'Allahabad Bar Association',
  'Lucknow Bar Association',
  'Other',
]

const fieldClass =
  'h-14 w-full rounded-xl border border-[#e4dfed] bg-white pl-12 pr-4 text-[#211a30] shadow-[0_7px_18px_rgba(63,41,104,0.10)] transition placeholder:text-[#aaa3b7] focus:border-[#7c4df1] focus:ring-4 focus:ring-[#7c4df1]/10'

export default function RegisterPage() {
  const { tr } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [bciNumber, setBciNumber] = useState('')
  const [barAssociation, setBarAssociation] = useState('Kanpur Bar Association')
  const [court, setCourt] = useState('District Court, Kanpur Nagar')
  const [termsAccepted, setTermsAccepted] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      toast.error(tr('Password must contain at least 8 characters', 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए'))
      return
    }
    if (!termsAccepted) {
      toast.error(tr('Please accept the Terms and Privacy Policy', 'कृपया सेवा की शर्तें और गोपनीयता नीति स्वीकार करें'))
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          bci_number: bciNumber || null,
          bar_association: barAssociation,
          primary_court: court,
          courts: [court],
        },
      },
    })

    if (authError) {
      toast.error(authError.message)
      setLoading(false)
      return
    }

    if (!authData.session) {
      await fetch('/api/guest-session', { method: 'DELETE' })
      toast.success(tr('Account created. Verify your email, then log in.', 'खाता बन गया। ईमेल सत्यापित करके लॉगिन करें।'))
      window.location.assign('/login?registered=1')
      return
    }

    if (!authData.user) {
      toast.error(tr('An account session could not be created. Please log in again.', 'खाता सत्र नहीं बन सका। कृपया दोबारा लॉगिन करें।'))
      setLoading(false)
      return
    }

    const { error: profileError } = await ensureAdvocateProfile(
      supabase,
      authData.user
    )
    if (profileError) {
      // The dashboard retries profile creation. Do not block a valid session.
      console.warn('Profile setup will be retried on dashboard:', profileError)
    }

    await fetch('/api/guest-session', { method: 'DELETE' })
    toast.success(tr('Registration completed! 🎉', 'पंजीकरण पूरा हुआ! 🎉'))
    window.location.assign('/dashboard')
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#17104b] px-4 py-8 sm:px-6 sm:py-12">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6"><LanguageToggle /></div>
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-24 -top-20 h-80 w-80 rounded-full bg-[#1498ff] opacity-90 blur-[90px]" />
        <div className="absolute right-[-7rem] top-[8%] h-96 w-96 rounded-full bg-[#ed43d2] opacity-80 blur-[100px]" />
        <div className="absolute bottom-[-8rem] left-[18%] h-96 w-96 rounded-full bg-[#5538ff] opacity-90 blur-[100px]" />
        <div className="absolute bottom-[-6rem] right-[-3rem] h-72 w-72 rounded-full bg-[#ff2f98] opacity-70 blur-[90px]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_40%,rgba(255,255,255,0.04))]" />
      </div>

      <section className="relative z-10 mx-auto w-full max-w-2xl">
        <div className="mb-7 text-center text-white">
          <div className="mb-2 flex items-center justify-center gap-2.5">
            <Scale className="h-9 w-9" strokeWidth={2.2} />
            <span className="text-3xl font-bold tracking-tight">VakilSaathi</span>
          </div>
          <p className="text-sm font-medium text-white/75">{tr('Your digital legal practice companion — free forever', 'आपका डिजिटल कानूनी सहयोगी — हमेशा मुफ़्त')}</p>
        </div>

        <div className="w-full rounded-[2rem] border border-white/70 bg-white/95 px-6 py-8 shadow-[0_30px_80px_rgba(19,9,74,0.38)] backdrop-blur-xl sm:px-10 sm:py-10">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-[74px] w-[74px] items-center justify-center rounded-full bg-gradient-to-br from-[#f044c5] via-[#8d47ec] to-[#2d8cff] p-[3px] shadow-[0_12px_30px_rgba(124,58,237,0.35)]">
              <div className="flex h-full w-full items-center justify-center rounded-full border border-white/50 bg-white/15">
                <User className="h-9 w-9 text-white" strokeWidth={2.2} />
              </div>
            </div>
            <h1 className="text-[2rem] font-bold tracking-tight text-[#21153f]">{tr('Create your free account', 'अपना मुफ़्त खाता बनाएँ')}</h1>
            <p className="mt-1.5 text-sm text-[#817991]">{tr('Enter all your details in one simple form', 'एक सरल फॉर्म में अपनी पूरी जानकारी भरें')}</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <Field label={tr('Full Name', 'पूरा नाम')} icon={<User />}>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={tr('Adv. Reyan Arif', 'अधि. रेयान आरिफ़')} autoComplete="name" required className={fieldClass} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={tr('Email', 'ईमेल')} icon={<Mail />}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr('Enter your email', 'अपना ईमेल दर्ज करें')} autoComplete="email" required className={fieldClass} />
              </Field>

              <Field label={tr('Password', 'पासवर्ड')} icon={<LockKeyhole />}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr('Minimum 8 characters', 'कम से कम 8 अक्षर')} autoComplete="new-password" minLength={8} required className={`${fieldClass} pr-12`} />
                <button type="button" onClick={() => setShowPass((current) => !current)} aria-label={showPass ? tr('Hide password', 'पासवर्ड छिपाएँ') : tr('Show password', 'पासवर्ड दिखाएँ')} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8b82a0] transition hover:bg-[#f3effb] hover:text-[#5f3dba]">
                  {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </Field>
            </div>

            <Field label={tr('BCI Enrollment Number (Optional)', 'BCI नामांकन संख्या (वैकल्पिक)')} icon={<BadgeCheck />}>
              <input value={bciNumber} onChange={(e) => setBciNumber(e.target.value)} placeholder="UP/123/2026" className={fieldClass} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={tr('Bar Association', 'बार एसोसिएशन')} icon={<Building2 />}>
                <select value={barAssociation} onChange={(e) => setBarAssociation(e.target.value)} className={`${fieldClass} appearance-none pr-11`}>
                  {BAR_ASSOCIATIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b82a0]" />
              </Field>

              <Field label={tr('Primary Court', 'मुख्य न्यायालय')} icon={<Landmark />}>
                <select value={court} onChange={(e) => setCourt(e.target.value)} className={`${fieldClass} appearance-none pr-11`}>
                  {COURTS.map((item) => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b82a0]" />
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e6e0ef] bg-[#faf8ff] p-4">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#7c4df1]" />
              <span className="text-xs leading-relaxed text-[#716a7d]">
                {tr('I agree to VakilSaathi’s', 'मैं VakilSaathi की')}{' '}
                <Link href="/terms" target="_blank" className="font-semibold text-[#6949c6] underline underline-offset-2">Terms &amp; Privacy Policy</Link>{' '}
                {tr('and understand that I am responsible for obtaining client consent before sending reminders.', 'से सहमत हूँ और समझता/समझती हूँ कि रिमाइंडर भेजने से पहले मुवक्किल की सहमति लेना मेरी जिम्मेदारी है।')}
              </span>
            </label>

            <button type="submit" disabled={loading} className="h-14 w-full rounded-xl bg-gradient-to-r from-[#ee42bd] via-[#9a45eb] to-[#276eea] text-base font-bold text-white shadow-[0_12px_28px_rgba(111,65,225,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(111,65,225,0.42)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
              {loading ? tr('Creating account...', 'खाता बनाया जा रहा है...') : tr('Create Free Account', 'मुफ़्त खाता बनाएँ')}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[#716a7d]">
            {tr('Already have an account?', 'पहले से खाता है?')}{' '}
            <Link href="/login" className="font-bold text-[#6949c6] transition hover:text-[#e23bb5]">{tr('Log In →', 'लॉगिन करें →')}</Link>
          </p>
        </div>
      </section>
    </main>
  )
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#332a46]">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#8b82a0] [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        {children}
      </div>
    </div>
  )
}
