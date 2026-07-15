'use client'

import { createContext, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'

export type Language = 'en' | 'hi'

interface LanguageContextValue {
  language: Language
  isHindi: boolean
  setLanguage: (language: Language) => void
  tr: (english: string, hindi: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children, initialLanguage = 'en' }: { children: React.ReactNode; initialLanguage?: Language }) {
  const router = useRouter()
  const [language, updateLanguage] = useState<Language>(initialLanguage)

  function setLanguage(nextLanguage: Language) {
    updateLanguage(nextLanguage)
    document.cookie = `vakil_language_v3=${nextLanguage}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = nextLanguage === 'hi' ? 'hi' : 'en'
    router.refresh()
  }

  const isHindi = language === 'hi'
  return (
    <LanguageContext.Provider value={{ language, isHindi, setLanguage, tr: (english, hindi) => isHindi ? hindi : english }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
