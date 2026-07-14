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
  Phone,
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
  const { isHindi } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [bciNumber, setBciNumber] = useState('')
  const [barAssociation, setBarAssociation] = useState('Kanpur Bar Association')
  const [court, setCourt] = useState('District Court, Kanpur Nagar')
  const [termsAccepted, setTermsAccepted] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('Password kam se kam 8 characters ka hona chahiye')
      return
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Sahi mobile number daalo (10 digits)')
      return
    }
    if (!termsAccepted) {
      toast.error('Terms & Privacy Policy accept karni padegi')
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
          phone,
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
      toast.success('Account ban gaya. Email verify karke login karein.')
      window.location.assign('/login?registered=1')
      return
    }

    if (!authData.user) {
      toast.error('Account session nahi bani. Dobara login karein.')
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
    toast.success('Registration ho gayi! 🎉')
    window.location.assign('/dashboard')
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#17104b] px-4 py-8 sm:px-6 sm:py-12">
      <div className="absolute right-4 top-4 z-20 text-white sm:right-6 sm:top-6"><LanguageToggle /></div>
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
          <p className="text-sm font-medium text-white/75">{isHindi ? 'अधिवक्ता का डिजिटल साथी — बिल्कुल मुफ़्त' : 'Your digital legal practice companion — free forever'}</p>
        </div>

        <div className="w-full rounded-[2rem] border border-white/70 bg-white/95 px-6 py-8 shadow-[0_30px_80px_rgba(19,9,74,0.38)] backdrop-blur-xl sm:px-10 sm:py-10">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-[74px] w-[74px] items-center justify-center rounded-full bg-gradient-to-br from-[#f044c5] via-[#8d47ec] to-[#2d8cff] p-[3px] shadow-[0_12px_30px_rgba(124,58,237,0.35)]">
              <div className="flex h-full w-full items-center justify-center rounded-full border border-white/50 bg-white/15">
                <User className="h-9 w-9 text-white" strokeWidth={2.2} />
              </div>
            </div>
            <h1 className="text-[2rem] font-bold tracking-tight text-[#21153f]">{isHindi ? 'मुफ़्त अकाउंट बनाएँ' : 'Create your free account'}</h1>
            <p className="mt-1.5 text-sm text-[#817991]">{isHindi ? 'सारी जानकारी एक ही बार में भरें' : 'Enter all your details in one simple form'}</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={isHindi ? 'पूरा नाम' : 'Full Name'} icon={<User />}>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={isHindi ? 'अधि. रेयान आरिफ़' : 'Adv. Reyan Arif'} autoComplete="name" required className={fieldClass} />
              </Field>

              <Field label={isHindi ? 'मोबाइल नंबर' : 'Mobile Number'} icon={<Phone />}>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" autoComplete="tel" inputMode="numeric" required className={fieldClass} />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={isHindi ? 'ईमेल' : 'Email'} icon={<Mail />}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isHindi ? 'अपना ईमेल दर्ज करें' : 'Enter your email'} autoComplete="email" required className={fieldClass} />
              </Field>

              <Field label={isHindi ? 'पासवर्ड' : 'Password'} icon={<LockKeyhole />}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isHindi ? 'कम से कम 8 अक्षर' : 'Minimum 8 characters'} autoComplete="new-password" minLength={8} required className={`${fieldClass} pr-12`} />
                <button type="button" onClick={() => setShowPass((current) => !current)} aria-label={showPass ? 'Password chhupayein' : 'Password dikhayein'} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8b82a0] transition hover:bg-[#f3effb] hover:text-[#5f3dba]">
                  {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </Field>
            </div>

            <Field label={isHindi ? 'BCI नामांकन संख्या (वैकल्पिक)' : 'BCI Enrollment Number (Optional)'} icon={<BadgeCheck />}>
              <input value={bciNumber} onChange={(e) => setBciNumber(e.target.value)} placeholder="UP/123/2026" className={fieldClass} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={isHindi ? 'बार एसोसिएशन' : 'Bar Association'} icon={<Building2 />}>
                <select value={barAssociation} onChange={(e) => setBarAssociation(e.target.value)} className={`${fieldClass} appearance-none pr-11`}>
                  {BAR_ASSOCIATIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b82a0]" />
              </Field>

              <Field label={isHindi ? 'मुख्य न्यायालय' : 'Primary Court'} icon={<Landmark />}>
                <select value={court} onChange={(e) => setCourt(e.target.value)} className={`${fieldClass} appearance-none pr-11`}>
                  {COURTS.map((item) => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b82a0]" />
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e6e0ef] bg-[#faf8ff] p-4">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#7c4df1]" />
              <span className="text-xs leading-relaxed text-[#716a7d]">
                Main VakilSaathi ki{' '}
                <Link href="/terms" target="_blank" className="font-semibold text-[#6949c6] underline underline-offset-2">Terms &amp; Privacy Policy</Link>{' '}
                se sahmat hoon aur client reminders ke liye zaroori consent lene ki zimmedari samajhta/samajhti hoon.
              </span>
            </label>

            <button type="submit" disabled={loading} className="h-14 w-full rounded-xl bg-gradient-to-r from-[#ee42bd] via-[#9a45eb] to-[#276eea] text-base font-bold text-white shadow-[0_12px_28px_rgba(111,65,225,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(111,65,225,0.42)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
              {loading ? (isHindi ? 'अकाउंट बन रहा है...' : 'Creating account...') : (isHindi ? 'मुफ़्त अकाउंट बनाएँ' : 'Create Free Account')}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[#716a7d]">
            {isHindi ? 'पहले से अकाउंट है?' : 'Already have an account?'}{' '}
            <Link href="/login" className="font-bold text-[#6949c6] transition hover:text-[#e23bb5]">{isHindi ? 'लॉग इन करें →' : 'Log In →'}</Link>
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
