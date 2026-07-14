'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Briefcase, ChevronRight, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'
import toast from 'react-hot-toast'
import Link from 'next/link'

const CASE_TYPES = ['Civil', 'Criminal', 'Family', 'Labour', 'Consumer', 'Revenue', 'Writ', 'Other']
const STATUSES = ['Active', 'Disposed', 'Stayed', 'Transferred', 'Withdrawn']
const COURTS_LIST = [
  'District Court, Kanpur Nagar',
  'District Court, Kanpur Dehat',
  'High Court, Allahabad',
  'High Court, Lucknow Bench',
  'Family Court, Kanpur',
  'Labour Court, Kanpur',
  'Consumer Forum, Kanpur',
  'Other',
]

interface Case {
  id: string
  case_number: string
  case_title?: string
  court_name: string
  judge_name?: string
  case_type: string
  opposite_party?: string
  status: string
  clients?: { full_name: string }
}

interface CaseForm {
  case_number: string
  case_title: string
  court_name: string
  judge_name: string
  case_type: string
  opposite_party: string
  status: string
}

export default function CasesPage() {
  const { isHindi } = useLanguage()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [advocateId, setAdvocateId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('All')

  const [form, setForm] = useState<CaseForm>({
    case_number: '',
    case_title: '',
    court_name: 'District Court, Kanpur Nagar',
    judge_name: '',
    case_type: 'Civil',
    opposite_party: '',
    status: 'Active',
  })

  const fetchCases = useCallback(async (advId: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cases')
      .select('*, clients(full_name)')
      .eq('advocate_id', advId)
      .order('created_at', { ascending: false })
    if (!error) setCases(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsGuest(true)
        setCases([])
        setLoading(false)
        return
      }
      const { data: adv } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
      if (adv) {
        setAdvocateId(adv.id)
        fetchCases(adv.id)
      }
    }
    init()
  }, [fetchCases])

  async function handleAddCase(e: React.SyntheticEvent) {
    e.preventDefault()

    if (!form.case_number.trim()) {
      toast.error('Case number zaroori hai')
      return
    }

    if (isGuest || !advocateId) {
      setSaving(true)
      const newCase: Case = {
        id: `guest-case-${Date.now()}`,
        ...form,
      }
      setCases(previousCases => [newCase, ...previousCases])
      toast.success('Case add ho gaya! ✅')
      setShowModal(false)
      setForm({ case_number: '', case_title: '', court_name: 'District Court, Kanpur Nagar', judge_name: '', case_type: 'Civil', opposite_party: '', status: 'Active' })
      setSaving(false)
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('cases').insert({ ...form, advocate_id: advocateId })
    if (error) {
      toast.error('Case save nahi hua: ' + error.message)
    } else {
      toast.success('Case add ho gaya! ✅')
      setShowModal(false)
      setForm({ case_number: '', case_title: '', court_name: 'District Court, Kanpur Nagar', judge_name: '', case_type: 'Civil', opposite_party: '', status: 'Active' })
      fetchCases(advocateId)
    }
    setSaving(false)
  }

  async function handleDelete(caseId: string, caseNumber: string) {
    if (!confirm(`Case "${caseNumber}" delete karna chahte hain?`)) return

    if (isGuest || !advocateId) {
      setCases(previousCases => previousCases.filter(c => c.id !== caseId))
      toast.success('Case delete ho gaya')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('cases').delete().eq('id', caseId)
    if (error) toast.error('Delete nahi hua')
    else {
      toast.success('Case delete ho gaya')
      setCases(prev => prev.filter(c => c.id !== caseId))
    }
  }

  const filtered = cases.filter(c => {
    const matchSearch = !search ||
      c.case_number.toLowerCase().includes(search.toLowerCase()) ||
      c.court_name.toLowerCase().includes(search.toLowerCase()) ||
      c.opposite_party?.toLowerCase().includes(search.toLowerCase()) ||
      (c.clients as { full_name: string } | undefined)?.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'All' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Active: 'bg-green-100 text-green-700',
      Disposed: 'bg-gray-100 text-gray-600',
      Stayed: 'bg-yellow-100 text-yellow-700',
      Transferred: 'bg-blue-100 text-blue-700',
      Withdrawn: 'bg-red-100 text-red-700',
    }
    return colors[status] ?? 'bg-gray-100 text-gray-600'
  }

  const caseTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      Civil: 'bg-blue-50 text-blue-600',
      Criminal: 'bg-red-50 text-red-600',
      Family: 'bg-purple-50 text-purple-600',
      Labour: 'bg-orange-50 text-orange-600',
      Consumer: 'bg-teal-50 text-teal-600',
      Revenue: 'bg-yellow-50 text-yellow-700',
      Writ: 'bg-indigo-50 text-indigo-600',
      Other: 'bg-gray-100 text-gray-600',
    }
    return colors[type] ?? 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{isHindi ? 'मुकदमे' : 'Cases Diary'}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {isHindi ? 'नया मुकदमा' : 'New Case'}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isHindi ? 'मुकदमा नंबर, अदालत या मुवक्किल खोजें...' : 'Search by case number, court, or client...'}
            className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 transition"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 transition">
          <option value="All">Sabhi Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">{isHindi ? 'कोई मुकदमा नहीं मिला' : 'No cases found'}</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-orange-500 text-sm hover:underline">
            + Pehla case add karein
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition group">
              <Link href={`/dashboard/cases/${c.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="bg-blue-600/10 rounded-lg p-2 flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-gray-900" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{c.case_number}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${caseTypeBadge(c.case_type)}`}>
                      {c.case_type}
                    </span>
                  </div>
                  {c.case_title && <p className="text-gray-600 text-xs mt-0.5">{c.case_title}</p>}
                  <p className="text-gray-400 text-xs mt-0.5">{c.court_name}</p>
                  {(c.clients as { full_name: string } | undefined)?.full_name && (
                    <p className="text-gray-400 text-xs">
                      Client: {(c.clients as { full_name: string }).full_name}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(c.id, c.case_number)}
                  className="p-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link href={`/dashboard/cases/${c.id}`}>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Case Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Naya Case Add Karein</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleAddCase} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Number *</label>
                  <input value={form.case_number} onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))}
                    placeholder="CS/123/2026" required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Title</label>
                  <input value={form.case_title} onChange={e => setForm(f => ({ ...f, case_title: e.target.value }))}
                    placeholder="Ram vs Shyam (optional)"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Court *</label>
                  <select value={form.court_name} onChange={e => setForm(f => ({ ...f, court_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {COURTS_LIST.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
                  <select value={form.case_type} onChange={e => setForm(f => ({ ...f, case_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {CASE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Judge Ka Naam</label>
                  <input value={form.judge_name} onChange={e => setForm(f => ({ ...f, judge_name: e.target.value }))}
                    placeholder="Hon'ble Judge..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opposite Party</label>
                  <input value={form.opposite_party} onChange={e => setForm(f => ({ ...f, opposite_party: e.target.value }))}
                    placeholder="Opposite party ka naam"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
                <button type="button" onClick={handleAddCase} disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 transition text-sm">
                  {saving ? 'Save ho raha hai...' : 'Case Save Karein ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
