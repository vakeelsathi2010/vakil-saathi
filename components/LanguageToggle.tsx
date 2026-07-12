'use client'

import { Languages } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage()

  return (
    <div className={`flex items-center rounded-full border border-white/25 bg-white/15 p-1 shadow-sm backdrop-blur-md ${compact ? '' : 'gap-1'}`}>
      {!compact && <Languages className="ml-1.5 h-4 w-4 text-current opacity-70" />}
      {(['en', 'hi'] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          aria-pressed={language === item}
          className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
            language === item
              ? 'bg-white text-[#5f3dba] shadow-sm'
              : 'text-current opacity-70 hover:opacity-100'
          }`}
        >
          {item === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  )
}
