'use client'

import { useEffect, useState } from 'react'
import { Languages, X } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'

const TUTORIAL_KEY = 'vakil_language_tutorial_seen_v1'
const TUTORIAL_EVENT = 'vakil-language-tutorial-dismissed'

interface LanguageToggleProps {
  compact?: boolean
  highlightTutorial?: boolean
  tutorialPosition?: 'above' | 'below'
}

export default function LanguageToggle({
  compact = false,
  highlightTutorial = false,
  tutorialPosition = 'below',
}: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage()
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (!highlightTutorial) return
    setShowTutorial(localStorage.getItem(TUTORIAL_KEY) !== '1')

    const hideTutorial = () => setShowTutorial(false)
    window.addEventListener(TUTORIAL_EVENT, hideTutorial)
    return () => window.removeEventListener(TUTORIAL_EVENT, hideTutorial)
  }, [highlightTutorial])

  function dismissTutorial() {
    localStorage.setItem(TUTORIAL_KEY, '1')
    setShowTutorial(false)
    window.dispatchEvent(new Event(TUTORIAL_EVENT))
  }

  function chooseLanguage(nextLanguage: 'en' | 'hi') {
    dismissTutorial()
    setLanguage(nextLanguage)
  }

  return (
    <div className="relative">
      {showTutorial && (
        <div
          role="status"
          className={`absolute right-0 z-[70] w-56 rounded-xl border border-amber-200 bg-white p-3 text-left text-gray-800 shadow-xl ${
            tutorialPosition === 'above' ? 'bottom-full mb-3' : 'top-full mt-3'
          }`}
        >
          <button type="button" onClick={dismissTutorial} aria-label="Close language tutorial" className="absolute right-2 top-2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="pr-5 text-sm font-bold">Choose your language</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">Use EN or हिंदी anytime to change the complete app language.</p>
          <div className={`absolute right-7 h-3 w-3 rotate-45 border-amber-200 bg-white ${
            tutorialPosition === 'above' ? '-bottom-1.5 border-b border-r' : '-top-1.5 border-l border-t'
          }`} />
        </div>
      )}

      <div className={`flex items-center rounded-full border p-1 shadow-sm backdrop-blur-md transition ${
        showTutorial
          ? 'border-amber-400 bg-amber-50 text-gray-800 ring-4 ring-amber-300/60 animate-pulse'
          : 'border-white/25 bg-white/15'
      } ${compact ? '' : 'gap-1'}`}>
        {!compact && <Languages className="ml-1.5 h-4 w-4 text-current opacity-70" />}
        {(['en', 'hi'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => chooseLanguage(item)}
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
    </div>
  )
}
