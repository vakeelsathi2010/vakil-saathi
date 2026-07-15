'use client'

import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/components/LanguageProvider'

export default function ResetPasswordPage() {
  const { tr } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 8) return toast.error(tr('Password must be at least 8 characters.', 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।'))
    if (password !== confirmPassword) return toast.error(tr('Passwords do not match.', 'दोनों पासवर्ड मेल नहीं खाते।'))
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(tr('The reset link is invalid or expired. Request a new link.', 'रीसेट लिंक अमान्य है या समाप्त हो गया है। नया लिंक माँगें।'))
      setLoading(false)
      return
    }
    toast.success(tr('Password updated successfully.', 'पासवर्ड सफलतापूर्वक बदल दिया गया।'))
    window.location.assign('/dashboard')
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f5f2] p-4">
    <div className="w-full max-w-md rounded-[30px] border border-white bg-white p-7 shadow-[0_26px_80px_rgba(31,25,20,.12)] sm:p-10">
      <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-extrabold"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff7438] text-white"><Scale className="h-5 w-5"/></span>VakilSaathi</span><LanguageToggle compact/></div>
      <h1 className="mt-9 text-3xl font-extrabold tracking-tight">{tr('Create a new password', 'नया पासवर्ड बनाएँ')}</h1>
      <p className="mt-2 text-sm leading-6 text-gray-500">{tr('Choose a secure password for your account.', 'अपने खाते के लिए सुरक्षित पासवर्ड चुनें।')}</p>
      <form onSubmit={save} className="mt-7 space-y-5">
        {[{ label: tr('New password', 'नया पासवर्ड'), value: password, set: setPassword }, { label: tr('Confirm password', 'पासवर्ड की पुष्टि करें'), value: confirmPassword, set: setConfirmPassword }].map((field, index) => <div key={field.label}><label htmlFor={`password-${index}`} className="mb-2 block text-sm font-semibold">{field.label}</label><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/><input id={`password-${index}`} type={show?'text':'password'} value={field.value} onChange={e=>field.set(e.target.value)} minLength={8} required className="h-14 w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-12 outline-none focus:border-[#ff7438] focus:ring-4 focus:ring-orange-100"/>{index===0&&<button type="button" onClick={()=>setShow(v=>!v)} aria-label={show?tr('Hide password','पासवर्ड छिपाएँ'):tr('Show password','पासवर्ड दिखाएँ')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">{show?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}</button>}</div></div>)}
        <button disabled={loading} className="h-14 w-full rounded-xl bg-[#ff7438] font-bold text-white shadow-lg shadow-orange-200 hover:bg-[#f2672c] disabled:opacity-60">{loading?tr('Updating...','बदला जा रहा है...'):tr('Update password','पासवर्ड बदलें')}</button>
      </form>
    </div>
  </main>
}
