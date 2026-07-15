'use client'

import {
  CheckCircle2,
  Crown,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderLock,
  HardDrive,
  LockKeyhole,
  Search,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'

const features = [
  {
    icon: Users,
    en: 'Client-wise folders',
    hi: 'मुवक्किल के अनुसार फ़ोल्डर',
    enText: 'Keep every client’s identity, case and supporting documents together.',
    hiText: 'हर मुवक्किल के पहचान, केस और सहायक दस्तावेज़ एक साथ रखें।',
  },
  {
    icon: ShieldCheck,
    en: 'Private document storage',
    hi: 'निजी दस्तावेज़ संग्रह',
    enText: 'Access-controlled storage designed for confidential legal records.',
    hiText: 'गोपनीय कानूनी रिकॉर्ड के लिए नियंत्रित पहुँच वाला संग्रह।',
  },
  {
    icon: Search,
    en: 'Fast document search',
    hi: 'तेज़ दस्तावेज़ खोज',
    enText: 'Find documents by client, case number, file name or document type.',
    hiText: 'मुवक्किल, केस नंबर, फ़ाइल नाम या दस्तावेज़ प्रकार से खोजें।',
  },
]

const supportedFiles = [
  { icon: FileText, label: 'PDF', color: 'bg-red-50 text-red-600' },
  { icon: FileImage, label: 'JPG / PNG', color: 'bg-blue-50 text-blue-600' },
  { icon: FileText, label: 'DOC / DOCX', color: 'bg-indigo-50 text-indigo-600' },
  { icon: FileSpreadsheet, label: 'XLS / XLSX', color: 'bg-green-50 text-green-600' },
]

export default function DocumentVaultPage() {
  const { tr } = useLanguage()

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{tr('Document Vault', 'दस्तावेज़ वॉल्ट')}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              <Crown className="h-3 w-3" /> {tr('Paid Feature', 'पेड फीचर')}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{tr('Securely organise client records and case documents in one place.', 'मुवक्किल के रिकॉर्ड और केस दस्तावेज़ एक सुरक्षित स्थान पर व्यवस्थित करें।')}</p>
        </div>
        <button disabled className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500">
          <UploadCloud className="h-4 w-4" /> {tr('Upload Document', 'दस्तावेज़ अपलोड करें')}
        </button>
      </header>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <FolderLock className="h-6 w-6 text-blue-200" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-blue-200">{tr('Premium module preview', 'प्रीमियम मॉड्यूल प्रीव्यू')}</p>
            <h2 className="mt-2 max-w-xl text-2xl font-bold leading-tight sm:text-3xl">{tr('Your digital chamber for every important case file', 'हर महत्वपूर्ण केस फ़ाइल के लिए आपका डिजिटल चैंबर')}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{tr('The Document Vault interface is ready. Secure cloud upload, storage limits and subscription access will be connected when the paid plan is launched.', 'Document Vault का इंटरफ़ेस तैयार है। पेड प्लान शुरू होने पर सुरक्षित क्लाउड अपलोड, स्टोरेज सीमा और सब्सक्रिप्शन एक्सेस जोड़ा जाएगा।')}</p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-200">
              {[tr('Case-linked files', 'केस से जुड़ी फ़ाइलें'), tr('Client folders', 'मुवक्किल फ़ोल्डर'), tr('Secure access', 'सुरक्षित पहुँच')].map(item => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />{item}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300">{tr('Vault status', 'वॉल्ट स्थिति')}</p>
                <p className="mt-1 font-semibold">{tr('Locked until paid launch', 'पेड लॉन्च तक लॉक')}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/15 text-amber-300"><LockKeyhole className="h-5 w-5" /></div>
            </div>
            <div className="mt-5 rounded-xl bg-black/20 p-4">
              <div className="flex items-center justify-between text-xs"><span className="text-slate-300">{tr('Storage used', 'उपयोग किया गया स्टोरेज')}</span><span>0 MB</span></div>
              <div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-2 w-0 rounded-full bg-blue-400" /></div>
              <p className="mt-2 text-[11px] text-slate-400">{tr('Storage allowance will depend on the selected paid plan.', 'स्टोरेज सीमा चुने गए पेड प्लान पर निर्भर करेगी।')}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, en, hi, enText, hiText }) => (
          <article key={en} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></div>
            <h3 className="mt-4 font-bold text-gray-900">{tr(en, hi)}</h3>
            <p className="mt-1.5 text-sm leading-6 text-gray-500">{tr(enText, hiText)}</p>
          </article>
        ))}
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-bold text-gray-900">{tr('Upload Documents', 'दस्तावेज़ अपलोड करें')}</h2><p className="mt-1 text-xs text-gray-500">{tr('Files will be linked to a client and case.', 'फ़ाइलें मुवक्किल और केस से जोड़ी जाएँगी।')}</p></div>
            <LockKeyhole className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-5 flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm"><UploadCloud className="h-6 w-6" /></div>
            <p className="mt-3 text-sm font-semibold text-gray-700">{tr('Drag files here or choose from your device', 'फ़ाइलें यहाँ खींचें या अपने डिवाइस से चुनें')}</p>
            <p className="mt-1 text-xs text-gray-400">{tr('Upload will be enabled with the paid storage integration.', 'पेड स्टोरेज इंटीग्रेशन के साथ अपलोड चालू होगा।')}</p>
            <button disabled className="mt-4 cursor-not-allowed rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-400">{tr('Choose Files — Locked', 'फ़ाइलें चुनें — लॉक')}</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {supportedFiles.map(({ icon: Icon, label, color }) => <span key={label} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${color}`}><Icon className="h-3.5 w-3.5" />{label}</span>)}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="font-bold text-gray-900">{tr('Vault Overview', 'वॉल्ट अवलोकन')}</h2><p className="mt-1 text-xs text-gray-500">{tr('Your saved folders will appear here.', 'आपके सहेजे गए फ़ोल्डर यहाँ दिखेंगे।')}</p></div><HardDrive className="h-5 w-5 text-gray-400" /></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 p-4"><p className="text-2xl font-bold text-blue-700">0</p><p className="mt-1 text-xs text-blue-600">{tr('Client Folders', 'मुवक्किल फ़ोल्डर')}</p></div>
            <div className="rounded-xl bg-purple-50 p-4"><p className="text-2xl font-bold text-purple-700">0</p><p className="mt-1 text-xs text-purple-600">{tr('Saved Files', 'सहेजी गई फ़ाइलें')}</p></div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-700">{tr('No documents yet', 'अभी कोई दस्तावेज़ नहीं')}</p>
            <p className="mt-1 text-xs leading-5 text-gray-400">{tr('After integration, uploaded client PDFs and case files will be organised and searchable here.', 'इंटीग्रेशन के बाद अपलोड किए गए मुवक्किल PDF और केस फ़ाइलें यहाँ व्यवस्थित और खोज योग्य होंगी।')}</p>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Crown className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div><p className="text-sm font-bold text-amber-800">{tr('Included in a future paid plan', 'भविष्य के पेड प्लान में शामिल')}</p><p className="mt-1 text-xs leading-5 text-amber-700">{tr('No payment is required now. Pricing and activation will be announced before launch.', 'अभी कोई भुगतान आवश्यक नहीं है। लॉन्च से पहले कीमत और एक्टिवेशन की जानकारी दी जाएगी।')}</p></div>
          </div>
        </div>
      </section>
    </div>
  )
}
