'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Users, Phone, Trash2, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'
import { maskPhone, normalizeIndianWhatsAppNumber } from '@/lib/whatsapp-link'
import toast from 'react-hot-toast'

interface Client {
  id: string
  full_name: string
  phone: string
  address?: string
  consent_given: boolean
  notes?: string
  cases?: { case_number: string; court_name: string }[]
}

interface Case {
  id: string
  case_number: string
  court_name: string
}

export default function ClientsPage() {
  const { isHindi } = useLanguage()
  const [clients, setClients] = useState<Client[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [advocateId, setAdvocateId] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    case_id: '',
    notes: '',
    consent_given: false,
  })

  const fetchData = useCallback(async (advId: string) => {
    const supabase = createClient()
    const [clientsRes, casesRes] = await Promise.all([
      supabase.from('clients').select('*, cases(case_number, court_name)').eq('advocate_id', advId).order('created_at', { ascending: false }),
      supabase.from('cases').select('id, case_number, court_name').eq('advocate_id', advId).eq('status', 'Active'),
    ])
    if (!clientsRes.error) setClients(clientsRes.data ?? [])
    if (!casesRes.error) setCases(casesRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!user) {
        setIsGuest(true)
        setClients([])
        setCases([])
        setLoading(false)
        return
      }
      const { data: adv } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
      if (adv) { setAdvocateId(adv.id); fetchData(adv.id) }
    }
    init()
  }, [fetchData])

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      toast.error('Sahi 10-digit mobile number daalo')
      return
    }
    if (isGuest) {
      const selectedCase = cases.find(item => item.id === form.case_id)
      const client: Client = {
        id: `guest-client-${Date.now()}`,
        full_name: form.full_name,
        phone: form.phone,
        address: form.address || undefined,
        notes: form.notes || undefined,
        consent_given: form.consent_given,
        cases: selectedCase ? [{ case_number: selectedCase.case_number, court_name: selectedCase.court_name }] : [],
      }
      setClients(previous => [client, ...previous])
      setShowModal(false)
      setForm({ full_name: '', phone: '', address: '', case_id: '', notes: '', consent_given: false })
      toast.success('Demo client add ho gaya')
      return
    }
    if (!advocateId) {
      toast.error('Advocate profile nahi mila')
      return
    }
    setSaving(true)
    const supabase = createClient()

    // Client insert karo
    const { data: newClient, error } = await supabase.from('clients').insert({
      advocate_id: advocateId,
      full_name: form.full_name,
      phone: form.phone,
      address: form.address || null,
      notes: form.notes || null,
      consent_given: form.consent_given,
    }).select().single()

    if (error) {
      toast.error('Client save nahi hua: ' + error.message)
      setSaving(false)
      return
    }

    // Agar case select kiya toh case update karo
    if (form.case_id && newClient) {
      await supabase.from('cases').update({ client_id: newClient.id }).eq('id', form.case_id)
    }

    if (form.consent_given) {
      toast.success('Client add ho gaya! WhatsApp consent save hua.', { duration: 4000 })
    } else {
      toast.success('Client add ho gaya!')
    }

    setShowModal(false)
    setForm({ full_name: '', phone: '', address: '', case_id: '', notes: '', consent_given: false })
    fetchData(advocateId)
    setSaving(false)
  }

  async function handleDelete(clientId: string, name: string) {
    if (!confirm(`Client "${name}" delete karna chahte hain?`)) return
    if (isGuest) {
      setClients(previous => previous.filter(client => client.id !== clientId))
      toast.success('Demo client delete ho gaya')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('clients').delete().eq('id', clientId)
    if (error) toast.error('Delete nahi hua')
    else {
      toast.success('Client delete ho gaya')
      setClients(prev => prev.filter(c => c.id !== clientId))
    }
  }

  const filtered = clients.filter(c =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{isHindi ? 'मुवक्किल' : 'Clients'}</h1>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" />
          Naya Client
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={isHindi ? 'मुवक्किल का नाम या नंबर खोजें...' : 'Search by client name or number...'}
          className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 transition" />
      </div>

      {/* Clients List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">{isHindi ? 'कोई मुवक्किल नहीं मिला' : 'No clients found'}</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-orange-500 text-sm hover:underline">
            + Pehla client add karein
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition group">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="bg-green-100 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-green-700 text-sm">{c.full_name[0].toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{c.full_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${c.consent_given ? 'bg-green-50 text-green-600 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                      {c.consent_given ? '✓ WhatsApp consent' : 'Consent pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-gray-400" />
                    <p className="text-gray-500 text-xs">{maskPhone(c.phone)}</p>
                  </div>
                  {(c.cases as { case_number: string }[] | undefined)?.length ? (
                    <p className="text-gray-400 text-xs mt-0.5">
                      Case: {(c.cases as { case_number: string }[])[0].case_number}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                {c.consent_given ? (
                  <a href={`https://wa.me/${normalizeIndianWhatsAppNumber(c.phone)}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${c.full_name}`}
                    className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition">
                    <MessageCircle className="w-4 h-4" />
                  </a>
                ) : (
                  <button type="button" disabled title="WhatsApp consent pending" className="p-2 text-gray-300 cursor-not-allowed">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
                <a href={`tel:+91${c.phone.replace(/\D/g, '')}`}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition">
                  <Phone className="w-4 h-4" />
                </a>
                <button onClick={() => handleDelete(c.id, c.full_name)}
                  className="p-2 text-gray-300 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Client Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Naya Client Add Karein</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poora Naam *</label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Client ka naam" required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile / WhatsApp Number *</label>
                <div className="flex gap-2">
                  <span className="border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-600 text-sm flex items-center">+91</span>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="9876543210" required maxLength={10} type="tel"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Se Link Karein</label>
                <select value={form.case_id} onChange={e => setForm(f => ({ ...f, case_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition">
                  <option value="">— Case select karein (optional) —</option>
                  {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.court_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Koi zaruri baat..." rows={2}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 transition resize-none" />
              </div>

              {/* Consent */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.consent_given} onChange={e => setForm(f => ({ ...f, consent_given: e.target.checked }))}
                    className="mt-1 w-4 h-4 accent-green-600" />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    <strong className="text-green-700">Main confirm karta/karti hoon ki client ne consent diya hai.</strong>
                    {' '}Yeh number case management aur hearing reminders ke liye WhatsApp par use ho sakta hai. Marketing message nahi bheja jayega.
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-60 transition text-sm">
                  {saving ? 'Save ho raha hai...' : 'Client Add Karein ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
