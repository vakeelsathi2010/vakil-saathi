'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Briefcase, CalendarDays, FileCheck2, ListTodo, Scale, User } from 'lucide-react'
import FeeLedger from '@/components/FeeLedger'
import CaseResearchLibrary from '@/components/CaseResearchLibrary'
import CaseTaskBoard from '@/components/CaseTaskBoard'

const STORAGE_KEY = 'vakil_guest_cases_v2'

interface GuestCase {
  id: string
  case_number: string
  case_title?: string
  court_name: string
  judge_name?: string
  case_type: string
  opposite_party?: string
  status: string
  notes?: string
  clients?: { full_name: string }
}

interface CaseMetadata {
  consultation_date?: string
  party_mobile?: string
  cnr_number?: string
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
  court_number?: string
  opposite_advocate?: string
  documents?: string[]
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

function parseMetadata(notes?: string): CaseMetadata {
  try {
    return notes ? JSON.parse(notes) as CaseMetadata : {}
  } catch {
    return {}
  }
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{value}</p>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-[#1e3a5f]">
        {icon}
        <h2 className="font-bold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function GuestCaseDetails({ caseId, isHindi }: { caseId: string; isHindi: boolean }) {
  const [caseData, setCaseData] = useState<GuestCase | null | undefined>(undefined)
  const tr = (english: string, hindi: string) => isHindi ? hindi : english

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY)
        const guestCases = stored ? JSON.parse(stored) as GuestCase[] : []
        setCaseData(guestCases.find(item => item.id === caseId) ?? null)
      } catch {
        setCaseData(null)
      }
    })
  }, [caseId])

  const metadata = useMemo(() => parseMetadata(caseData?.notes), [caseData?.notes])
  if (caseData === undefined) {
    return <div className="p-6 text-sm text-gray-500">{tr('Loading case...', 'केस लोड हो रहा है...')}</div>
  }

  if (!caseData) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="font-bold text-amber-900">{tr('Guest case is no longer available', 'गेस्ट केस अब उपलब्ध नहीं है')}</h1>
        <p className="mt-2 text-sm text-amber-800">{tr('Guest records remain only in the current browser session.', 'गेस्ट रिकॉर्ड केवल मौजूदा ब्राउज़र सत्र में रहते हैं।')}</p>
        <Link href="/dashboard/cases" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft className="h-4 w-4" /> {tr('Back to Case Reports', 'केस रिपोर्ट पर वापस जाएँ')}</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/cases" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{tr('Matter File', 'मामला फाइल')}</p>
          <h1 className="truncate text-xl font-bold text-[#1e3a5f]">{caseData.case_number}</h1>
          <p className="truncate text-sm text-gray-500">{caseData.case_title}</p>
        </div>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{caseData.status}</span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Section icon={<User className="h-5 w-5" />} title={tr('Client & Contact', 'मुवक्किल और संपर्क')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label={tr('Client', 'मुवक्किल')} value={caseData.clients?.full_name} />
            <Detail label={tr('Mobile / WhatsApp', 'मोबाइल / व्हाट्सऐप')} value={metadata.party_mobile} />
          </div>
        </Section>

        <Section icon={<Briefcase className="h-5 w-5" />} title={tr('Matter Status', 'मामले की स्थिति')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label={tr('Case type', 'केस प्रकार')} value={caseData.case_type} />
            <Detail label={tr('Nature', 'प्रकृति')} value={metadata.matter_nature} />
            <Detail label={tr('Urgency', 'तात्कालिकता')} value={metadata.urgency} />
            <Detail label={tr('Consultation date', 'परामर्श तिथि')} value={metadata.consultation_date} />
          </div>
        </Section>
      </div>

      <Section icon={<Scale className="h-5 w-5" />} title={tr('Matter Intake', 'मामले की प्रारंभिक जानकारी')}>
        <div className="grid gap-5 md:grid-cols-2">
          <Detail label={tr('Facts / problem summary', 'तथ्य / समस्या का सार')} value={metadata.facts_summary} />
          <Detail label={tr('Relief / client objective', 'राहत / मुवक्किल का उद्देश्य')} value={metadata.relief_sought} />
          <Detail label={tr('Acts / sections', 'अधिनियम / धाराएँ')} value={metadata.acts_sections} />
          <Detail label={metadata.limitation_type ? (isHindi ? DEADLINE_TYPE_HI[metadata.limitation_type] || metadata.limitation_type : metadata.limitation_type) : tr('Limitation deadline', 'समय-सीमा')} value={metadata.limitation_date} />
          <Detail label={tr('Deadline basis / note', 'समय-सीमा का आधार / टिप्पणी')} value={metadata.limitation_notes} />
        </div>
      </Section>

      <Section icon={<CalendarDays className="h-5 w-5" />} title={tr('Court & Filing', 'न्यायालय और दाखिला')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label={tr('Court', 'न्यायालय')} value={caseData.court_name} />
          <Detail label={tr('Court / room', 'कोर्ट / कक्ष')} value={metadata.court_number} />
          <Detail label={tr('Judge', 'न्यायाधीश')} value={caseData.judge_name} />
          <Detail label={tr('Filing number', 'फाइलिंग नंबर')} value={metadata.filing_number} />
          <Detail label={tr('Filing date', 'फाइलिंग तिथि')} value={metadata.filing_date} />
          <Detail label="CNR" value={metadata.cnr_number} />
          <Detail label={tr('Opposite party', 'विपक्षी पक्ष')} value={caseData.opposite_party} />
          <Detail label={tr('Opposite advocate', 'विपक्षी अधिवक्ता')} value={metadata.opposite_advocate} />
        </div>
      </Section>

      <Section icon={<FileCheck2 className="h-5 w-5" />} title={tr('Documents Received', 'प्राप्त दस्तावेज़')}>
          {metadata.documents?.length ? (
            <div className="flex flex-wrap gap-2">{metadata.documents.map(document => <span key={document} className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">{document}</span>)}</div>
          ) : <p className="text-sm text-gray-500">{tr('No documents marked as received.', 'कोई दस्तावेज़ प्राप्त चिह्नित नहीं है।')}</p>}
      </Section>

      <FeeLedger caseId={caseData.id} caseNumber={caseData.case_number} initialNotes={caseData.notes} isGuest />

      <CaseResearchLibrary caseId={caseData.id} caseNumber={caseData.case_number} initialNotes={caseData.notes} isGuest />

      <CaseTaskBoard caseId={caseData.id} caseNumber={caseData.case_number} initialNotes={caseData.notes} isGuest />

      <Section icon={<ListTodo className="h-5 w-5" />} title={tr('Next Action', 'अगला कार्य')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label={tr('Action', 'कार्य')} value={metadata.next_action} />
          <Detail label={tr('Deadline', 'अंतिम तिथि')} value={metadata.next_action_deadline} />
        </div>
        {metadata.internal_notes && <div className="mt-4 flex gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /><span>{metadata.internal_notes}</span></div>}
      </Section>

      <p className="text-center text-xs text-gray-400">{tr('Guest data is temporary and clears when this browser session ends.', 'गेस्ट डेटा अस्थायी है और ब्राउज़र सत्र समाप्त होने पर हट जाएगा।')}</p>
    </div>
  )
}
