import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate, getHearingUrgency, urgencyColor, urgencyLabel } from '@/lib/utils'
import { ArrowLeft, Calendar, User, Gavel, History, Clock3, CheckCircle2, FileCheck2, Phone } from 'lucide-react'
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

interface StoredCaseMetadata {
  case_start_date?: string
  party_mobile?: string
  documents?: string[]
}

function parseCaseMetadata(notes?: string | null): StoredCaseMetadata {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes) as StoredCaseMetadata
    return {
      case_start_date: parsed.case_start_date,
      party_mobile: parsed.party_mobile,
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    }
  } catch {
    return {}
  }
}

function HearingRow({ hearing, isPast }: { hearing: HearingDetailData; isPast: boolean }) {
  const urgency = getHearingUrgency(hearing.hearing_date)
  const hearingDate = new Date(`${hearing.hearing_date}T00:00:00`)

  return (
    <div className={`flex items-start gap-4 px-5 py-4 ${isPast ? 'bg-gray-50/60' : 'bg-white'}`}>
      <div className={`flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl border ${isPast ? 'border-gray-200 bg-white text-gray-600' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
        <span className="text-base font-bold leading-none">{hearingDate.getDate()}</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase">{hearingDate.toLocaleDateString('en', { month: 'short' })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">{hearing.hearing_purpose || 'Hearing'}</p>
            <p className="mt-0.5 text-xs text-gray-500">{formatDate(hearing.hearing_date)}</p>
          </div>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${urgencyColor(urgency)}`}>
            {urgencyLabel(urgency)}
          </span>
        </div>
        {hearing.outcome && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-white p-2 text-xs text-gray-600 ring-1 ring-gray-100">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
            <span><strong className="text-gray-700">Outcome:</strong> {hearing.outcome}</span>
          </div>
        )}
        {hearing.next_date && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-orange-600">
            <Clock3 className="h-3.5 w-3.5" /> Next date: {formatDate(hearing.next_date)}
          </p>
        )}
      </div>
    </div>
  )
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
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
  const caseMetadata = parseCaseMetadata(caseData.notes)
  const hasStructuredMetadata = Boolean(
    caseMetadata.case_start_date ||
    caseMetadata.party_mobile ||
    caseMetadata.documents?.length
  )
  const legacyNotes = hasStructuredMetadata ? null : caseData.notes
  const todayKey = new Date().toISOString().split('T')[0]
  const upcomingHearings = [...(hearings ?? [])]
    .filter(hearing => hearing.hearing_date >= todayKey)
    .sort((a, b) => a.hearing_date.localeCompare(b.hearing_date))
  const pastHearings = [...(hearings ?? [])]
    .filter(hearing => hearing.hearing_date < todayKey)
    .sort((a, b) => b.hearing_date.localeCompare(a.hearing_date))
  const orderedHearings = [...upcomingHearings, ...pastHearings]

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
            { label: 'Case Start Date', value: caseMetadata.case_start_date ? formatDate(caseMetadata.case_start_date) : '—', icon: '📅' },
            { label: 'Mobile Number', value: caseMetadata.party_mobile || '—', icon: '📱' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">{icon} {label}</p>
              <p className="font-medium text-gray-800 text-sm">{value}</p>
            </div>
          ))}
        </div>

        {legacyNotes && (
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <p className="text-xs text-yellow-600 mb-1">📝 Notes</p>
            <p className="text-sm text-gray-700">{legacyNotes}</p>
          </div>
        )}
      </div>

      {/* Documents received from party */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-[#1e3a5f]">Documents Received</h3>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{caseMetadata.documents?.length ?? 0} received</span>
        </div>
        {!caseMetadata.documents?.length ? (
          <p className="text-sm text-gray-400">No documents marked as received yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {caseMetadata.documents.map(document => (
              <div key={document} className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" /> {document}
              </div>
            ))}
          </div>
        )}
        {caseMetadata.party_mobile && (
          <a href={`tel:${caseMetadata.party_mobile}`} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
            <Phone className="h-4 w-4" /> Call party
          </a>
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

        {(hearings?.length ?? 0) > 0 && (
          <div className="border-b border-gray-100 px-5 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <History className="h-4 w-4 text-orange-500" /> Complete Hearing History
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{upcomingHearings.length} Upcoming</span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{pastHearings.length} Past</span>
            </div>
          </div>
        )}

        {!hearings || hearings.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Gavel className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Koi peshi nahi daali gayi</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orderedHearings.map(hearing => (
              <HearingRow
                key={hearing.id}
                hearing={hearing}
                isPast={hearing.hearing_date < todayKey}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
