import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate, getHearingUrgency, urgencyColor, urgencyLabel } from '@/lib/utils'
import { ArrowLeft, Calendar, User, Gavel } from 'lucide-react'
import { cookies } from 'next/headers'

interface CaseDetailData {
  id: string
  case_number: string
  case_title?: string | null
  court_name: string
  case_type: string
  judge_name?: string | null
  opposite_party?: string | null
  status: string
  notes?: string | null
  clients?: { full_name: string; phone: string } | null
}

interface HearingDetailData {
  id: string
  hearing_date: string
  hearing_purpose?: string | null
  outcome?: string | null
  next_date?: string | null
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const isGuest = cookieStore.get('vakil_guest')?.value === '1'
  const isHindi = cookieStore.get('vakil_language_v2')?.value === 'hi'

  if (!user && isGuest) redirect('/dashboard/cases')

  let caseData: CaseDetailData | null = null
  let hearings: HearingDetailData[] | null = null

  if (!user) redirect('/login')
  const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
  if (!advocate) redirect('/login')

  const { data } = await supabase
    .from('cases')
    .select('*, clients(*)')
    .eq('id', id)
    .eq('advocate_id', advocate.id)
    .single()
  caseData = data as CaseDetailData | null

  const { data: hearingData } = await supabase
    .from('hearings')
    .select('*')
    .eq('case_id', id)
    .order('hearing_date', { ascending: false })
  hearings = hearingData as HearingDetailData[] | null

  if (!caseData) notFound()

  const statusColors: Record<string, string> = {
    Active: 'bg-green-100 text-green-700 border-green-200',
    Disposed: 'bg-gray-100 text-gray-600 border-gray-200',
    Stayed: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Transferred: 'bg-blue-100 text-blue-700 border-blue-200',
    Withdrawn: 'bg-red-100 text-red-700 border-red-200',
  }

  const client = caseData.clients as { full_name: string; phone: string } | null

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/cases" className="text-gray-400 hover:text-[#1e3a5f] transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-[#1e3a5f]">{isHindi ? 'मुकदमे का विवरण' : 'Case Details'}</h1>
      </div>

      {/* Case Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{caseData.case_number}</h2>
            {caseData.case_title && <p className="text-gray-500 text-sm mt-0.5">{caseData.case_title}</p>}
          </div>
          <span className={`text-sm px-3 py-1 rounded-full border font-medium ${statusColors[caseData.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {caseData.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          {[
            { label: isHindi ? 'अदालत' : 'Court', value: caseData.court_name, icon: '🏛️' },
            { label: isHindi ? 'मुकदमे का प्रकार' : 'Case Type', value: caseData.case_type, icon: '📋' },
            { label: isHindi ? 'न्यायाधीश' : 'Judge', value: caseData.judge_name || '—', icon: '⚖️' },
            { label: isHindi ? 'विपक्षी पक्ष' : 'Opposite Party', value: caseData.opposite_party || '—', icon: '👤' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">{icon} {label}</p>
              <p className="font-medium text-gray-800 text-sm">{value}</p>
            </div>
          ))}
        </div>

        {caseData.notes && (
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <p className="text-xs text-yellow-600 mb-1">📝 Notes</p>
            <p className="text-sm text-gray-700">{caseData.notes}</p>
          </div>
        )}
      </div>

      {/* Client Info */}
      {client && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-orange-500" />
            <h3 className="font-semibold text-[#1e3a5f]">{isHindi ? 'मुवक्किल' : 'Client'}</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">{client.full_name}</p>
              <p className="text-gray-500 text-sm">{client.phone}</p>
            </div>
            <a href={`https://wa.me/91${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="text-green-600 text-sm border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition">
              WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Hearings */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-500" />
            <h3 className="font-semibold text-[#1e3a5f]">{isHindi ? 'पेशियाँ' : 'Hearings'} ({hearings?.length ?? 0})</h3>
          </div>
          <Link href="/dashboard/hearings" className="text-orange-500 text-sm hover:underline">+ Nai Peshi</Link>
        </div>

        {!hearings || hearings.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Gavel className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Koi peshi nahi daali gayi</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {hearings.map(h => {
              const urgency = getHearingUrgency(h.hearing_date)
              const isPast = urgency === 'past'
              return (
                <div key={h.id} className={`px-5 py-4 flex items-center justify-between ${isPast ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[44px]">
                      <p className="text-xl font-bold text-[#1e3a5f]">
                        {new Date(h.hearing_date).getDate()}
                      </p>
                      <p className="text-xs text-gray-400 uppercase">
                        {new Date(h.hearing_date).toLocaleDateString('en', { month: 'short' })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(h.hearing_date).getFullYear()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{h.hearing_purpose || 'Peshi'}</p>
                      {h.outcome && <p className="text-xs text-gray-500 mt-0.5">→ {h.outcome}</p>}
                      {h.next_date && (
                        <p className="text-xs text-orange-500 mt-0.5">
                          Next: {formatDate(h.next_date)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${urgencyColor(urgency)}`}>
                    {urgencyLabel(urgency)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
