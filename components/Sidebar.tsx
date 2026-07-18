'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Scale, LayoutDashboard, Briefcase, Users, Calendar, Bell, LogOut, Menu, X, FolderLock, IndianRupee, BookOpenCheck, UsersRound, Mic, Gavel, ChartNoAxesCombined, Share2, BrainCircuit, ScanText, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage, type Language } from '@/components/LanguageProvider'

const navItems = [
  { href: '/dashboard', en: 'Dashboard', hi: 'डैशबोर्ड', mobileEn: 'Home', mobileHi: 'होम', icon: LayoutDashboard },
  { href: '/dashboard/cases', en: 'Case Reports', hi: 'केस रिपोर्ट', mobileEn: 'Reports', mobileHi: 'रिपोर्ट', icon: Briefcase },
  { href: '/dashboard/hearings', en: 'Case Dates', hi: 'केस की तारीखें', mobileEn: 'Dates', mobileHi: 'तारीखें', icon: Calendar },
  { href: '/dashboard/clients', en: 'Clients', hi: 'मुवक्किल', mobileEn: 'Clients', mobileHi: 'मुवक्किल', icon: Users },
  { href: '/dashboard/fees', en: 'Fees & Payments', hi: 'फीस और भुगतान', mobileEn: 'Fees', mobileHi: 'फीस', icon: IndianRupee },
  { href: '/dashboard/analytics', en: 'Analytics', hi: 'विश्लेषण', mobileEn: 'Analytics', mobileHi: 'विश्लेषण', icon: ChartNoAxesCombined, footer: false },
  { href: '/dashboard/advanced-analytics', en: 'Advanced Analytics', hi: 'उन्नत विश्लेषण', mobileEn: 'Advanced', mobileHi: 'उन्नत', icon: ChartNoAxesCombined, footer: false, premium: true },
  { href: '/dashboard/portal', en: 'Client Portal', hi: 'क्लाइंट पोर्टल', mobileEn: 'Portal', mobileHi: 'पोर्टल', icon: Share2, footer: false },
  { href: '/dashboard/strategy', en: 'Case Strategy', hi: 'केस रणनीति', mobileEn: 'Strategy', mobileHi: 'रणनीति', icon: BrainCircuit, footer: false, premium: true },
  { href: '/dashboard/ocr', en: 'Court Order OCR', hi: 'कोर्ट ऑर्डर OCR', mobileEn: 'OCR', mobileHi: 'OCR', icon: ScanText, footer: false, premium: true },
  { href: '/dashboard/bail', en: 'Bail Tracker', hi: 'जमानत ट्रैकर', mobileEn: 'Bail', mobileHi: 'जमानत', icon: ShieldCheck, footer: false },
  { href: '/dashboard/research', en: 'Legal Research', hi: 'कानूनी शोध', mobileEn: 'Research', mobileHi: 'शोध', icon: BookOpenCheck, footer: false },
  { href: '/dashboard/tasks', en: 'Team Tasks', hi: 'टीम कार्य', mobileEn: 'Tasks', mobileHi: 'कार्य', icon: UsersRound, footer: false },
  { href: '/dashboard/voice-input', en: 'Voice Updates', hi: 'वॉइस अपडेट', mobileEn: 'Voice', mobileHi: 'वॉइस', icon: Mic, footer: false },
  { href: '/dashboard/judges', en: 'Judge Notes', hi: 'न्यायाधीश नोट्स', mobileEn: 'Judges', mobileHi: 'न्यायाधीश', icon: Gavel, footer: false },
  { href: '/dashboard/reminders', en: 'Reminders', hi: 'रिमाइंडर', mobileEn: 'Alerts', mobileHi: 'अलर्ट', icon: Bell },
  { href: '/dashboard/documents', en: 'Document Vault', hi: 'दस्तावेज़ वॉल्ट', mobileEn: 'Vault', mobileHi: 'वॉल्ट', icon: FolderLock, premium: true },
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
      {navItems.map(({ href, en, hi, icon: Icon, premium }) => {
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
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {premium && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">{language === 'hi' ? 'पेड' : 'Paid'}</span>}
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
        <div className="mb-2 flex justify-center"><LanguageToggle /></div>
        {advocateName && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{getInitials(advocateName)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {isGuest ? advocateName : `Adv. ${advocateName.split(' ')[0]}`}
              </p>
              <p className="text-[10px] text-gray-400">{language === 'hi' ? (isGuest ? 'अतिथि मोड' : 'अधिवक्ता') : (isGuest ? 'Guest mode' : 'Advocate')}</p>
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
  const { language, tr } = useLanguage()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await fetch('/api/guest-session', { method: 'DELETE' })
    if (!isGuest) {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    toast.success(tr('Logged out successfully', 'सफलतापूर्वक लॉग आउट हो गए'))
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
          <LanguageToggle compact />
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
          {navItems.filter(item => !item.premium && item.footer !== false).map(({ href, en, mobileEn, mobileHi, icon: Icon }) => {
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
