import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate, getHearingUrgency, urgencyColor, urgencyLabel } from '@/lib/utils'
import { ArrowLeft, Calendar, User, Gavel, History, Clock3, CheckCircle2, ExternalLink, FileCheck2, Phone, AlertTriangle, ListTodo, Scale } from 'lucide-react'
import { cookies } from 'next/headers'
import GuestCaseDetails from '@/components/GuestCaseDetails'
import FeeLedger from '@/components/FeeLedger'
import CaseResearchLibrary from '@/components/CaseResearchLibrary'
import CaseTaskBoard from '@/components/CaseTaskBoard'
import VoiceUpdateHistory from '@/components/VoiceUpdateHistory'
import StatusTracker from '@/src/components/StatusTracker'
import CaseChecklist from '@/src/components/CaseChecklist'

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
  consultation_date?: string
  case_start_date?: string
  party_mobile?: string
  cnr_number?: string
  court_number?: string
  documents?: string[]
  matter_nature?: string
  facts_summary?: string
  relief_sought?: string
  acts_sections?: string
  urgency?: string
  limitation_type?: string
  limitation_date?: string
  limitation_notes?: string
  filing_number?: string
  filing_date?: string
  opposite_advocate?: string
  agreed_fee?: string
  advance_received?: string
  fee_notes?: string
  next_action?: string
  next_action_deadline?: string
  internal_notes?: string
}

const DEADLINE_TYPE_HI: Record<string, string> = {
  'Appeal / Revision Filing': 'अपील / पुनरीक्षण दाखिला',
  'Written Statement / Reply': 'लिखित बयान / जवाब',
  'Evidence / Affidavit Filing': 'साक्ष्य / शपथपत्र दाखिला',
  'Compliance / Objection Removal': 'अनुपालन / आपत्ति निवारण',
  'Legal Notice Response': 'कानूनी नोटिस का जवाब',
  'Execution / Enforcement': 'निष्पादन / प्रवर्तन',
  'Review / Recall Application': 'पुनर्विचार / रिकॉल आवेदन',
  'Other Statutory Deadline': 'अन्य वैधानिक समय-सीमा',
}

function parseCaseMetadata(notes?: string | null): StoredCaseMetadata {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes) as StoredCaseMetadata
    return {
      case_start_date: parsed.case_start_date,
      consultation_date: parsed.consultation_date,
      party_mobile: parsed.party_mobile,
      cnr_number: parsed.cnr_number,
      court_number: parsed.court_number,
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      matter_nature: parsed.matter_nature,
      facts_summary: parsed.facts_summary,
      relief_sought: parsed.relief_sought,
      acts_sections: parsed.acts_sections,
      urgency: parsed.urgency,
      limitation_type: parsed.limitation_type,
      limitation_date: parsed.limitation_date,
      limitation_notes: parsed.limitation_notes,
      filing_number: parsed.filing_number,
      filing_date: parsed.filing_date,
      opposite_advocate: parsed.opposite_advocate,
      agreed_fee: parsed.agreed_fee,
      advance_received: parsed.advance_received,
      fee_notes: parsed.fee_notes,
      next_action: parsed.next_action,
      next_action_deadline: parsed.next_action_deadline,
      internal_notes: parsed.internal_notes,
    }
  } catch {
    return {}
  }
}

function HearingRow({ hearing, isPast, isHindi }: { hearing: HearingDetailData; isPast: boolean; isHindi: boolean }) {
  const tr = (english: string, hindi: string) => isHindi ? hindi : english
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
            <p className="text-sm font-semibold text-gray-900">{hearing.hearing_purpose || tr('Hearing', 'सुनवाई')}</p>
            <p className="mt-0.5 text-xs text-gray-500">{formatDate(hearing.hearing_date)}</p>
          </div>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${urgencyColor(urgency)}`}>
            {isHindi ? ({ today: 'आज', tomorrow: 'कल', soon: 'जल्द', upcoming: 'आगामी', past: 'पूर्ण' } as Record<string, string>)[urgency] || urgencyLabel(urgency) : urgencyLabel(urgency)}
          </span>
        </div>
        {hearing.outcome && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-white p-2 text-xs text-gray-600 ring-1 ring-gray-100">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
            <span><strong className="text-gray-700">{tr('Outcome', 'परिणाम')}:</strong> {hearing.outcome}</span>
          </div>
        )}
        {hearing.next_date && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-orange-600">
            <Clock3 className="h-3.5 w-3.5" /> {tr('Next date', 'अगली तारीख')}: {formatDate(hearing.next_date)}
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
  const isHindi = cookieStore.get('vakil_language_v3')?.value === 'hi'
  const tr = (english: string, hindi: string) => isHindi ? hindi : english

  if (!user && isGuest && id.startsWith('guest-case-')) {
    return <GuestCaseDetails caseId={id} isHindi={isHindi} />
  }
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
    'New Enquiry': 'bg-sky-100 text-sky-700 border-sky-200',
    'Documents Pending': 'bg-amber-100 text-amber-700 border-amber-200',
    Drafting: 'bg-purple-100 text-purple-700 border-purple-200',
    'Legal Notice': 'bg-orange-100 text-orange-700 border-orange-200',
    'Ready for Filing': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    Filed: 'bg-blue-100 text-blue-700 border-blue-200',
    'Scrutiny / Objection': 'bg-red-100 text-red-700 border-red-200',
    Registered: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    Active: 'bg-green-100 text-green-700 border-green-200',
    Evidence: 'bg-violet-100 text-violet-700 border-violet-200',
    Arguments: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    'Judgment Reserved': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Appeal / Execution': 'bg-teal-100 text-teal-700 border-teal-200',
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
    caseMetadata.cnr_number ||
    caseMetadata.court_number ||
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
        <h1 className="text-xl font-bold text-[#1e3a5f]">{tr('Case Details', 'केस विवरण')}</h1>
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
            { label: tr('Court', 'न्यायालय'), value: caseData.court_name, icon: '🏛️' },
            { label: tr('Court / Room Number', 'न्यायालय / कक्ष संख्या'), value: caseMetadata.court_number || '—', icon: '🚪' },
            { label: tr('Case Type', 'केस का प्रकार'), value: caseData.case_type, icon: '📋' },
            { label: tr('Judge', 'न्यायाधीश'), value: caseData.judge_name || '—', icon: '⚖️' },
            { label: tr('Opposite Party', 'विपक्षी पक्ष'), value: caseData.opposite_party || '—', icon: '👤' },
            { label: tr('Consultation / Matter Start', 'परामर्श / मामला शुरू'), value: (caseMetadata.consultation_date || caseMetadata.case_start_date) ? formatDate(caseMetadata.consultation_date || caseMetadata.case_start_date || '') : '—', icon: '📅' },
            { label: tr('Mobile Number', 'मोबाइल नंबर'), value: caseMetadata.party_mobile || '—', icon: '📱' },
            { label: tr('Filing Number', 'फाइलिंग नंबर'), value: caseMetadata.filing_number || '—', icon: '🗂️' },
            { label: tr('Filing Date', 'दाखिला तारीख'), value: caseMetadata.filing_date ? formatDate(caseMetadata.filing_date) : '—', icon: '📥' },
            { label: tr('eCourts CNR Number', 'eCourts CNR नंबर'), value: caseMetadata.cnr_number || '—', icon: '🔎' },
            { label: tr('Opposite Advocate', 'विपक्षी अधिवक्ता'), value: caseMetadata.opposite_advocate || '—', icon: '⚖️' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">{icon} {label}</p>
              <p className="font-medium text-gray-800 text-sm">{value}</p>
            </div>
          ))}
        </div>

        {legacyNotes && (
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <p className="text-xs text-yellow-600 mb-1">📝 {tr('Notes', 'टिप्पणियाँ')}</p>
            <p className="text-sm text-gray-700">{legacyNotes}</p>
          </div>
        )}
      </div>

      {/* Matter intake overview */}
      {(caseMetadata.matter_nature || caseMetadata.facts_summary || caseMetadata.relief_sought || caseMetadata.acts_sections || caseMetadata.limitation_date) && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Scale className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-[#1e3a5f]">{tr('Matter Intake', 'मामले की प्रारंभिक जानकारी')}</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-blue-50 p-3"><p className="text-xs text-blue-500">{tr('Nature of Matter', 'मामले की प्रकृति')}</p><p className="mt-1 text-sm font-semibold text-blue-950">{caseMetadata.matter_nature || caseData.case_type}</p></div>
            <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-400">{tr('Urgency', 'प्राथमिकता')}</p><p className="mt-1 text-sm font-semibold text-gray-800">{caseMetadata.urgency || tr('Normal', 'सामान्य')}</p></div>
          </div>
          {caseMetadata.facts_summary && <div className="mt-3 rounded-lg border border-gray-100 p-3"><p className="text-xs font-medium text-gray-400">{tr('Facts / Client Problem', 'तथ्य / मुवक्किल की समस्या')}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">{caseMetadata.facts_summary}</p></div>}
          {caseMetadata.relief_sought && <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3"><p className="text-xs font-medium text-green-600">{tr('Relief / Client Objective', 'मांगी गई राहत / मुवक्किल का उद्देश्य')}</p><p className="mt-1 whitespace-pre-wrap text-sm text-green-900">{caseMetadata.relief_sought}</p></div>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {caseMetadata.acts_sections && <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-400">{tr('Acts / Sections', 'अधिनियम / धाराएँ')}</p><p className="mt-1 text-sm font-medium text-gray-800">{caseMetadata.acts_sections}</p></div>}
            {caseMetadata.limitation_date && <div className="rounded-lg border border-orange-100 bg-orange-50 p-3"><p className="flex items-center gap-1 text-xs text-orange-600"><AlertTriangle className="h-3.5 w-3.5" /> {caseMetadata.limitation_type ? (isHindi ? DEADLINE_TYPE_HI[caseMetadata.limitation_type] || caseMetadata.limitation_type : caseMetadata.limitation_type) : tr('Limitation / Critical Deadline', 'लिमिटेशन / महत्वपूर्ण समय-सीमा')}</p><p className="mt-1 text-sm font-semibold text-orange-900">{formatDate(caseMetadata.limitation_date)}</p>{caseMetadata.limitation_notes && <p className="mt-1 text-xs leading-5 text-orange-700">{caseMetadata.limitation_notes}</p>}<p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-orange-600">{tr('Alerts: 7 days · 3 days · 1 day', 'अलर्ट: 7 दिन · 3 दिन · 1 दिन')}</p></div>}
          </div>
        </div>
      )}

      {(caseMetadata.next_action || caseMetadata.internal_notes) && (
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><ListTodo className="h-4 w-4 text-purple-600" /><h3 className="font-semibold text-[#1e3a5f]">{tr('Next Action', 'अगला कार्य')}</h3></div>
              {caseMetadata.next_action && <p className="text-sm font-medium text-gray-800">{caseMetadata.next_action}</p>}
              {caseMetadata.next_action_deadline && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700"><Clock3 className="h-3.5 w-3.5" /> {formatDate(caseMetadata.next_action_deadline)}</p>}
              {caseMetadata.internal_notes && <div className="mt-3 rounded-lg border border-yellow-100 bg-yellow-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-700">{tr('Private advocate note', 'अधिवक्ता की निजी टिप्पणी')}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-gray-700">{caseMetadata.internal_notes}</p></div>}
            </div>
        </div>
      )}

      <FeeLedger caseId={caseData.id} caseNumber={caseData.case_number} initialNotes={caseData.notes} />

      <CaseResearchLibrary caseId={caseData.id} caseNumber={caseData.case_number} initialNotes={caseData.notes} />

      <CaseTaskBoard caseId={caseData.id} caseNumber={caseData.case_number} initialNotes={caseData.notes} />

      <StatusTracker caseId={caseData.id} />

      <VoiceUpdateHistory initialNotes={caseData.notes} />

      <CaseChecklist
        caseType={caseData.case_type}
        caseTitle={caseData.case_title || caseData.case_number}
        initialItems={caseMetadata.documents || []}
      />

      {/* Documents received from party */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-[#1e3a5f]">{tr('Documents Received', 'प्राप्त दस्तावेज़')}</h3>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{caseMetadata.documents?.length ?? 0} {tr('received', 'प्राप्त')}</span>
        </div>
        {!caseMetadata.documents?.length ? (
          <p className="text-sm text-gray-400">{tr('No documents marked as received yet.', 'अभी तक कोई दस्तावेज़ प्राप्त चिह्नित नहीं किया गया है।')}</p>
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
            <Phone className="h-4 w-4" /> {tr('Call party', 'पक्षकार को कॉल करें')}
          </a>
        )}
        {caseMetadata.cnr_number && (
          <a href="https://services.ecourts.gov.in/ecourtindia_v6/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50">
            <ExternalLink className="h-4 w-4" /> {tr('Verify CNR on official eCourts', 'आधिकारिक eCourts पर CNR सत्यापित करें')}
          </a>
        )}
      </div>

      {/* Client Info */}
      {client && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-orange-500" />
            <h3 className="font-semibold text-[#1e3a5f]">{tr('Client', 'मुवक्किल')}</h3>
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
            <h3 className="font-semibold text-[#1e3a5f]">{tr('Hearings', 'सुनवाई')} ({hearings?.length ?? 0})</h3>
          </div>
          <Link href="/dashboard/hearings" className="text-orange-500 text-sm hover:underline">+ {tr('New Hearing', 'नई सुनवाई')}</Link>
        </div>

        {(hearings?.length ?? 0) > 0 && (
          <div className="border-b border-gray-100 px-5 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <History className="h-4 w-4 text-orange-500" /> {tr('Complete Hearing History', 'सुनवाई का पूरा इतिहास')}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{upcomingHearings.length} {tr('Upcoming', 'आगामी')}</span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{pastHearings.length} {tr('Past', 'पिछली')}</span>
            </div>
          </div>
        )}

        {!hearings || hearings.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Gavel className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{tr('No hearings have been added', 'कोई सुनवाई नहीं जोड़ी गई है')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orderedHearings.map(hearing => (
              <HearingRow
                key={hearing.id}
                hearing={hearing}
                isPast={hearing.hearing_date < todayKey}
                isHindi={isHindi}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
