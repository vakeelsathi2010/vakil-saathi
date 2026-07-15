'use client'

import { Languages } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage()
  return (
    <div className={`inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm ${compact ? 'gap-0.5' : 'gap-1'}`} aria-label="App language">
      {!compact && <Languages className="ml-1.5 h-4 w-4 text-gray-500" />}
      <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'} className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${language === 'en' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>EN</button>
      <button type="button" onClick={() => setLanguage('hi')} aria-pressed={language === 'hi'} className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${language === 'hi' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>हिं</button>
    </div>
  )
}
