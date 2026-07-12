'use client'

import { createContext, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'

export type Language = 'en' | 'hi'

interface LanguageContextValue {
  language: Language
  isHindi: boolean
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children, initialLanguage = 'en' }: { children: React.ReactNode; initialLanguage?: Language }) {
  const router = useRouter()
  const [language, updateLanguage] = useState<Language>(initialLanguage)

  function setLanguage(nextLanguage: Language) {
    updateLanguage(nextLanguage)
    document.cookie = `vakil_language=${nextLanguage}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }

  return (
    <LanguageContext.Provider value={{ language, isHindi: language === 'hi', setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
