'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, MessageCircle, Phone, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'
import DeadlineSafetyCenter, { type DeadlineCase } from '@/components/DeadlineSafetyCenter'

interface ReminderLog {
  id: string
  hearing_id: string
  recipient_type: string
  phone: string
  channel: string
  status: string
  error_msg?: string
  sent_at: string
  hearings?: {
    hearing_date: string
    cases?: { case_number: string; court_name: string }
  }
}

export default function RemindersPage() {
  const { isHindi, tr } = useLanguage()
  const [logs, setLogs] = useState<ReminderLog[]>([])
  const [deadlineCases, setDeadlineCases] = useState<DeadlineCase[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) {
      setLogs([])
      try {
        const storedCases = window.sessionStorage.getItem('vakil_guest_cases_v2')
        setDeadlineCases(storedCases ? JSON.parse(storedCases) as DeadlineCase[] : [])
      } catch {
        setDeadlineCases([])
      }
      setLoading(false)
      return
    }

    // RLS automatically filters to current user's data
    const { data } = await supabase
      .from('reminder_logs')
      .select(
        `*, hearings(hearing_date, cases(case_number, court_name))`
      )
      .order('sent_at', { ascending: false })
      .limit(100)

    setLogs(data ?? [])

    const { data: casesData } = await supabase
      .from('cases')
      .select('id, case_number, case_title, court_name, status, notes')
      .order('created_at', { ascending: false })

    setDeadlineCases((casesData ?? []) as DeadlineCase[])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs()
  }, [fetchLogs])

  const sentStatuses = ['sent', 'manual_sent', 'manual_case_update_sent']
  const sentCount = logs.filter((l) => sentStatuses.includes(l.status)).length
  const reminderCount = logs.filter((l) => l.status === 'manual_sent' || l.status === 'sent').length
  const caseUpdateCount = logs.filter((l) => l.status === 'manual_case_update_sent').length
  const whatsappCount = logs.filter((l) => l.channel === 'whatsapp').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{tr('Reminders & Deadlines', 'रिमाइंडर और समय-सीमाएँ')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {tr('Protect critical filing dates and review communication sent to clients', 'महत्वपूर्ण दाखिला तारीखों की सुरक्षा करें और मुवक्किलों को भेजे गए संदेश देखें')}
        </p>
      </div>

      <DeadlineSafetyCenter cases={deadlineCases} />

      <div className="pt-2">
        <h2 className="text-lg font-bold text-gray-900">{tr('Client Communication History', 'मुवक्किल संचार इतिहास')}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{tr('Hearing reminders and post-hearing updates confirmed as sent', 'भेजे गए सुनवाई रिमाइंडर और सुनवाई के बाद के अपडेट')}</p>
      </div>

      {/* Summary cards */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: tr('Total Sent', 'कुल भेजे गए'), value: sentCount, color: 'text-gray-900', bg: 'bg-gray-100' },
            { label: tr('Hearing Reminders', 'सुनवाई रिमाइंडर'), value: reminderCount, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: tr('Case Updates', 'केस अपडेट'), value: caseUpdateCount, color: 'text-purple-700', bg: 'bg-purple-50' },
            { label: 'WhatsApp', value: whatsappCount, color: 'text-green-700', bg: 'bg-green-50' },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.bg} rounded-xl px-4 py-3 border border-white`}
            >
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Logs list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {tr('Loading...', 'लोड हो रहा है...')}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">
            {tr('No reminders have been sent yet', 'अभी तक कोई रिमाइंडर नहीं भेजा गया है')}
          </p>
          <p className="text-gray-400 text-xs mt-1">
            {tr('Add case dates to prepare reminders before each hearing', 'हर सुनवाई से पहले रिमाइंडर तैयार करने के लिए केस की तारीखें जोड़ें')}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {logs.map((log) => {
            const hearing = log.hearings as
              | {
                  hearing_date: string
                  cases?: { case_number: string; court_name: string }
                }
              | undefined
            const caseData = hearing?.cases
            const isSent = sentStatuses.includes(log.status)
            const isCaseUpdate = log.status === 'manual_case_update_sent'
            const isManual = log.status === 'manual_sent' || isCaseUpdate

            return (
              <div
                key={log.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Channel icon */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      log.channel === 'whatsapp'
                        ? 'bg-green-100'
                        : 'bg-blue-100'
                    }`}
                  >
                    {log.channel === 'whatsapp' ? (
                      <MessageCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Phone className="w-4 h-4 text-blue-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {caseData?.case_number ?? tr('Case N/A', 'केस उपलब्ध नहीं')}
                      </p>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          log.recipient_type === 'advocate'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-purple-50 text-purple-600'
                        }`}
                      >
                        {log.recipient_type === 'advocate' ? tr('Advocate', 'अधिवक्ता') : tr('Client', 'मुवक्किल')}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">
                        {log.channel}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isCaseUpdate ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'}`}>
                        {isCaseUpdate ? tr('Case Update', 'केस अपडेट') : tr('Hearing Reminder', 'सुनवाई रिमाइंडर')}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      📞 {log.phone}
                      {caseData?.court_name ? ` • ${caseData.court_name}` : ''}
                    </p>
                    {hearing?.hearing_date && (
                      <p className="text-gray-400 text-xs">
                        {tr('Hearing', 'सुनवाई')}:{' '}
                        {new Date(hearing.hearing_date).toLocaleDateString(
                          isHindi ? 'hi-IN' : 'en-IN',
                          { day: 'numeric', month: 'short', year: 'numeric' }
                        )}
                      </p>
                    )}
                    <p className="text-gray-300 text-xs">
                      {tr('Sent', 'भेजा गया')}:{' '}
                      {new Date(log.sent_at).toLocaleString(isHindi ? 'hi-IN' : 'en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  {isSent ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-600 font-medium">
                        {isManual ? tr('Confirmed sent', 'भेजने की पुष्टि') : tr('Sent', 'भेजा गया')}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-red-500 font-medium">
                        {tr('Failed', 'विफल')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
