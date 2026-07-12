'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, MessageCircle, Phone, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_REMINDER_LOGS } from '@/lib/demo-data'
import { useLanguage } from '@/components/LanguageProvider'

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
  const { isHindi } = useLanguage()
  const [logs, setLogs] = useState<ReminderLog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLogs(DEMO_REMINDER_LOGS)
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
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs()
  }, [fetchLogs])

  const sentCount = logs.filter((l) => l.status === 'sent').length
  const whatsappCount = logs.filter((l) => l.channel === 'whatsapp').length
  const smsCount = logs.filter((l) => l.channel === 'sms').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{isHindi ? 'रिमाइंडर' : 'Reminders'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isHindi ? 'भेजे गए सभी WhatsApp / SMS रिमाइंडर का रिकॉर्ड' : 'Complete record of sent WhatsApp / SMS reminders'}
        </p>
      </div>

      {/* Summary cards */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Bheje', value: logs.length, color: 'text-gray-900', bg: 'bg-gray-100' },
            { label: 'Successful', value: sentCount, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'WhatsApp', value: whatsappCount, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'SMS', value: smsCount, color: 'text-blue-700', bg: 'bg-blue-50' },
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
          Loading...
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">
            Abhi tak koi reminder nahi bheja
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Peshi dates add karo — reminder automatically jaayega ek din pehle
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
            const isSent = log.status === 'sent'

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
                        {caseData?.case_number ?? 'Case N/A'}
                      </p>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          log.recipient_type === 'advocate'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-purple-50 text-purple-600'
                        }`}
                      >
                        {log.recipient_type === 'advocate' ? 'Advocate' : 'Client'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">
                        {log.channel}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      📞 {log.phone}
                      {caseData?.court_name ? ` • ${caseData.court_name}` : ''}
                    </p>
                    {hearing?.hearing_date && (
                      <p className="text-gray-400 text-xs">
                        Peshi:{' '}
                        {new Date(hearing.hearing_date).toLocaleDateString(
                          'en-IN',
                          { day: 'numeric', month: 'short', year: 'numeric' }
                        )}
                      </p>
                    )}
                    <p className="text-gray-300 text-xs">
                      Bheja:{' '}
                      {new Date(log.sent_at).toLocaleString('en-IN', {
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
                        Bheja
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-red-500 font-medium">
                        Failed
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
