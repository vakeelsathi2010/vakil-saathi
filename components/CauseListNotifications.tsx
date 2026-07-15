'use client'

import { useEffect, useState } from 'react'
import { Bell, BellRing, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '@/components/LanguageProvider'

interface CauseListNotificationsProps {
  userId: string
  todayCases: CauseAlertCase[]
  tomorrowCases: CauseAlertCase[]
}

export interface CauseAlertCase {
  caseNumber: string
  court: string
  courtNumber?: string | null
  judge?: string | null
  stage?: string | null
}

type PermissionState = NotificationPermission | 'unsupported'

function caseLine(item: CauseAlertCase, isHindi: boolean) {
  const location = item.courtNumber ? `${item.court} (${isHindi ? 'कक्ष' : 'Room'} ${item.courtNumber})` : item.court
  const context = [item.judge, item.stage].filter(Boolean).join(' · ')
  return `${item.caseNumber} — ${location}${context ? ` — ${context}` : ''}`
}

export default function CauseListNotifications({ userId, todayCases, tomorrowCases }: CauseListNotificationsProps) {
  const { isHindi, tr } = useLanguage()
  const [permission, setPermission] = useState<PermissionState>('unsupported')
  const todayCount = todayCases.length
  const tomorrowCount = tomorrowCases.length

  useEffect(() => {
    if (!('Notification' in window)) return
    queueMicrotask(() => setPermission(Notification.permission))

    if (Notification.permission !== 'granted') return
    const dayKey = new Date().toLocaleDateString('en-CA')
    const storageKey = `vakil_cause_alert_${userId}_${dayKey}`
    if (localStorage.getItem(storageKey) === '1') return

    const primaryCases = todayCount > 0 ? todayCases : tomorrowCases
    const heading = todayCount > 0
      ? (isHindi ? `आज ${todayCount} केस` : `${todayCount} case${todayCount === 1 ? '' : 's'} today`)
      : tomorrowCount > 0
        ? (isHindi ? `कल ${tomorrowCount} केस` : `${tomorrowCount} case${tomorrowCount === 1 ? '' : 's'} tomorrow`)
        : (isHindi ? 'आज या कल कोई सुनवाई नहीं' : 'No hearings today or tomorrow')
    const detailLines = primaryCases.slice(0, 3).map(item => caseLine(item, isHindi))
    if (primaryCases.length > 3) detailLines.push(isHindi ? `और ${primaryCases.length - 3} केस` : `and ${primaryCases.length - 3} more`)
    const body = [heading, ...detailLines].join('\n')
    new Notification(isHindi ? 'VakilSaathi केस सूची' : 'VakilSaathi Cause List', { body, icon: '/favicon.ico', tag: `cause-list-${dayKey}` })
    localStorage.setItem(storageKey, '1')
  }, [isHindi, todayCases, tomorrowCases, todayCount, tomorrowCount, userId])

  async function enableNotifications() {
    if (!('Notification' in window)) {
      toast.error(tr('This browser does not support device notifications', 'यह ब्राउज़र डिवाइस सूचनाओं का समर्थन नहीं करता'))
      return
    }
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      toast.success(tr('Daily cause-list device alerts enabled', 'दैनिक वाद सूची डिवाइस अलर्ट चालू हो गए'))
      const dayKey = new Date().toLocaleDateString('en-CA')
      localStorage.removeItem(`vakil_cause_alert_${userId}_${dayKey}`)
      window.location.reload()
    } else {
      toast.error(tr('Notification permission was not allowed', 'सूचना की अनुमति नहीं दी गई'))
    }
  }

  if (permission === 'granted') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> {tr('Device alerts on', 'डिवाइस अलर्ट चालू')}
      </div>
    )
  }

  return (
    <button onClick={enableNotifications} className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-100">
      {permission === 'denied' ? <Bell className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
      {permission === 'denied' ? tr('Allow alerts in browser settings', 'ब्राउज़र सेटिंग में अलर्ट की अनुमति दें') : tr('Enable daily device alert', 'दैनिक डिवाइस अलर्ट चालू करें')}
    </button>
  )
}
