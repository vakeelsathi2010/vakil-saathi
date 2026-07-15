'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, MessageCircle, Phone, Scale, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'
import LanguageToggle from '@/components/LanguageToggle'

interface AdvocateProfileSetupProps {
  advocateId: string
  initialName?: string | null
}

export default function AdvocateProfileSetup({
  advocateId,
  initialName,
}: AdvocateProfileSetupProps) {
  const { tr } = useLanguage()
  const [phone, setPhone] = useState('')
  const [isWhatsApp, setIsWhatsApp] = useState(false)
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error(tr('Please enter a valid 10-digit Indian mobile number', 'सही 10 अंकों का भारतीय मोबाइल नंबर दर्ज करें'))
      return
    }
    if (!isWhatsApp || !consent) {
      toast.error(tr('WhatsApp confirmation and consent are required', 'WhatsApp पुष्टि और सहमति आवश्यक है'))
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error: profileError } = await supabase
      .from('advocates')
      .update({ phone })
      .eq('id', advocateId)

    if (profileError) {
      if (profileError.code === '23505') {
        toast.error(tr('This mobile number is already linked to another account', 'यह मोबाइल नंबर पहले से किसी अन्य खाते से जुड़ा है'))
        setSaving(false)
        return
      }
      toast.error(`${tr('Mobile number could not be saved', 'मोबाइल नंबर सुरक्षित नहीं हो सका')}: ${profileError.message}`)
      setSaving(false)
      return
    }

    const { error: userError } = await supabase.auth.updateUser({
      data: {
        whatsapp_number: phone,
        whatsapp_opt_in: true,
        whatsapp_consent_at: new Date().toISOString(),
        phone_verification_status: 'user_confirmed_unverified',
        phone_user_confirmed_at: new Date().toISOString(),
        profile_setup_completed: true,
        profile_setup_completed_at: new Date().toISOString(),
      },
    })

    if (userError) {
      toast.error(`${tr('Consent could not be saved', 'सहमति सुरक्षित नहीं हो सकी')}: ${userError.message}`)
      setSaving(false)
      return
    }

    toast.success(tr('WhatsApp number saved as user-confirmed (not OTP-verified)', 'WhatsApp नंबर उपयोगकर्ता द्वारा पुष्ट रूप में सहेजा गया है (OTP से सत्यापित नहीं)'))
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#f6f5f2] p-4">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6"><LanguageToggle compact /></div>
      <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
        <div className="bg-gradient-to-br from-[#ff7438] to-[#f15d2a] px-6 py-7 text-white sm:px-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Scale className="h-7 w-7" />
          </div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-white/75">{tr('Required one-time setup', 'एक बार आवश्यक सेटअप')}</p>
          <h2 className="text-2xl font-bold">{tr('Complete your advocate profile', 'अपनी अधिवक्ता प्रोफ़ाइल पूरी करें')}</h2>
          <p className="mt-1.5 text-sm leading-6 text-white/80">
            {initialName ? `${tr('Welcome', 'स्वागत है')}, ${initialName}. ` : ''}{tr('Add your WhatsApp number once so hearing alerts and client communication stay connected.', 'अपना WhatsApp नंबर जोड़ें ताकि सुनवाई अलर्ट और मुवक्किल से संपर्क जुड़े रहें।')}
          </p>
        </div>

        <form onSubmit={saveProfile} className="space-y-5 px-6 py-6 sm:px-8">
          <div>
            <label htmlFor="advocate-mobile" className="mb-2 block text-sm font-semibold text-gray-800">
              {tr('Mobile number', 'मोबाइल नंबर')}
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <span className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">+91</span>
              <input
                id="advocate-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                className="h-14 w-full rounded-xl border border-gray-200 bg-gray-50 pl-20 pr-4 text-base font-medium text-gray-900 outline-none transition focus:border-[#ff7438] focus:bg-white focus:ring-4 focus:ring-orange-100"
                required
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <input type="checkbox" checked={isWhatsApp} onChange={(event) => setIsWhatsApp(event.target.checked)} className="mt-0.5 h-4 w-4 accent-green-600" />
            <MessageCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
            <span>
              <span className="block text-sm font-semibold text-green-900">{tr('This number is available on WhatsApp', 'यह नंबर WhatsApp पर उपलब्ध है')}</span>
              <span className="mt-0.5 block text-xs leading-5 text-green-700">{tr('Used for your account contact and future hearing-alert services.', 'खाता संपर्क और भविष्य की सुनवाई अलर्ट सेवाओं के लिए उपयोग किया जाएगा।')}</span>
            </span>
          </label>

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">{tr('User-confirmed number — OTP verification is not active yet', 'उपयोगकर्ता द्वारा पुष्ट नंबर — OTP सत्यापन अभी सक्रिय नहीं है')}</p>
              <p className="mt-1 text-xs leading-5 text-amber-700">{tr('No SMS or WhatsApp message will be sent and no verification charge will apply. OTP verification can be enabled later.', 'कोई SMS या WhatsApp संदेश नहीं भेजा जाएगा और कोई सत्यापन शुल्क नहीं लगेगा। OTP सत्यापन बाद में चालू किया जा सकता है।')}</p>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
            <ShieldCheck className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <span className="text-xs leading-5 text-blue-900">
              {tr('I agree that VakilSaathi may store this number for account communication and hearing alerts. I can change my preference later.', 'मैं सहमत हूँ कि VakilSaathi खाता संपर्क और सुनवाई अलर्ट के लिए यह नंबर सुरक्षित रख सकता है। मैं बाद में अपनी पसंद बदल सकता/सकती हूँ।')}
            </span>
          </label>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
            {tr('Client reminders continue to open in WhatsApp for the advocate to review and send manually.', 'मुवक्किल के रिमाइंडर अधिवक्ता द्वारा जाँचकर स्वयं भेजने के लिए WhatsApp में खुलेंगे।')}
          </div>

          <button type="submit" disabled={saving} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#ff7438] px-4 font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-[#f2672c] disabled:cursor-not-allowed disabled:opacity-60">
            <CheckCircle2 className="h-5 w-5" />
            {saving ? tr('Saving profile...', 'प्रोफ़ाइल सुरक्षित हो रही है...') : tr('Save and open dashboard', 'सुरक्षित करें और डैशबोर्ड खोलें')}
          </button>
        </form>
      </div>
    </div>
  )
}
