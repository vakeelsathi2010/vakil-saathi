'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Scale, LayoutDashboard, Briefcase, Users, Calendar, Bell, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage, type Language } from '@/components/LanguageProvider'

const navItems = [
  { href: '/dashboard', en: 'Dashboard', mobileEn: 'Home', hi: 'डैशबोर्ड', mobileHi: 'होम', icon: LayoutDashboard },
  { href: '/dashboard/cases', en: 'Cases Diary', mobileEn: 'Diary', hi: 'मुकदमे', mobileHi: 'मुकदमे', icon: Briefcase },
  { href: '/dashboard/hearings', en: 'Hearing Dates', mobileEn: 'Hearings', hi: 'पेशी की तारीखें', mobileHi: 'पेशी', icon: Calendar },
  { href: '/dashboard/clients', en: 'Clients', mobileEn: 'Clients', hi: 'मुवक्किल', mobileHi: 'मुवक्किल', icon: Users },
  { href: '/dashboard/reminders', en: 'Reminders', mobileEn: 'Alerts', hi: 'रिमाइंडर', mobileHi: 'अलर्ट', icon: Bell },
]

interface SidebarProps {
  advocateName?: string
  isGuest?: boolean
}

function getInitials(name?: string) {
  if (!name) return 'A'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface NavLinksProps {
  pathname: string
  language: Language
  onClick?: () => void
}

function NavLinks({ pathname, language, onClick }: NavLinksProps) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {navItems.map(({ href, en, hi, icon: Icon }) => {
        const label = language === 'hi' ? hi : en
        const active = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              active
                ? 'bg-blue-50 text-blue-700 border-l-[3px] border-blue-600 pl-[9px]'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

interface SidebarContentProps {
  pathname: string
  language: Language
  advocateName?: string
  isGuest: boolean
  onClick?: () => void
  onLogout: () => void
}

function SidebarContent({ pathname, language, advocateName, isGuest, onClick, onLogout }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
        <Scale className="text-orange-500 w-6 h-6 flex-shrink-0" />
        <span className="text-gray-900 text-base font-bold tracking-tight">VakilSaathi</span>
      </div>

      <NavLinks pathname={pathname} language={language} onClick={onClick} />

      <div className="px-3 pb-4 border-t border-gray-100 pt-3 space-y-1">
        <div className="mb-2 flex justify-center text-gray-700">
          <LanguageToggle highlightTutorial tutorialPosition="above" />
        </div>
        {advocateName && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{getInitials(advocateName)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {isGuest ? advocateName : `Adv. ${advocateName.split(' ')[0]}`}
              </p>
              <p className="text-[10px] text-gray-400">{language === 'hi' ? (isGuest ? 'गेस्ट मोड' : 'अधिवक्ता') : (isGuest ? 'Guest mode' : 'Advocate')}</p>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
          {language === 'hi' ? 'लॉग आउट' : 'Logout'}
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({ advocateName, isGuest = false }: SidebarProps) {
  const pathname = usePathname()
  const { language } = useLanguage()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await fetch('/api/guest-session', { method: 'DELETE' })
    if (!isGuest) {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    toast.success('Logout ho gaya')
    window.location.assign('/login')
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Scale className="text-orange-500 w-5 h-5" />
          <span className="text-gray-900 font-bold text-base">VakilSaathi</span>
        </div>
        <div className="flex items-center gap-2 text-gray-700">
          <LanguageToggle compact highlightTutorial tutorialPosition="below" />
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-600 p-1">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full w-[200px] z-50 shadow-xl transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent pathname={pathname} language={language} advocateName={advocateName} isGuest={isGuest} onLogout={handleLogout} onClick={() => setMobileOpen(false)} />
      </div>

      {/* Mobile Footer Navigation */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
        <nav
          aria-label="Mobile navigation"
          className="pointer-events-auto mx-auto flex h-[68px] max-w-md items-center justify-between gap-1 rounded-[24px] border border-gray-200 bg-white/95 p-2 shadow-[0_14px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
        >
          {navItems.map(({ href, en, mobileEn, mobileHi, icon: Icon }) => {
            const active = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
            const label = language === 'hi' ? mobileHi : mobileEn

            return (
              <Link
                key={href}
                href={href}
                aria-label={language === 'hi' ? mobileHi : en}
                aria-current={active ? 'page' : undefined}
                className={`flex h-12 shrink-0 items-center justify-center rounded-[18px] transition-all duration-200 ${
                  active
                    ? 'min-w-[88px] gap-2 bg-[#111827] px-3 text-white shadow-md'
                    : 'w-11 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.2 : 1.9} />
                {active && <span className="whitespace-nowrap text-[11px] font-semibold">{label}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col w-[200px] flex-shrink-0 h-screen sticky top-0">
        <SidebarContent pathname={pathname} language={language} advocateName={advocateName} isGuest={isGuest} onLogout={handleLogout} />
      </div>
    </>
  )
}
