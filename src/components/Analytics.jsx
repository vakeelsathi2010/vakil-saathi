'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, CalendarClock, CircleDollarSign, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const COLORS = ['#2563eb', '#ef4444']
const money = value => `\u20B9${Number(value || 0).toLocaleString('en-IN')}`
const monthKey = value => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = key => new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1))
const isWon = (status = '') => /won|allowed|granted|favour/i.test(status)
const isLost = (status = '') => /lost|dismissed|rejected|against/i.test(status)
const isClosed = (status = '') => /closed|disposed|judgment received|won|lost|dismissed|rejected/i.test(status)

export default function Analytics() {
  const [cases, setCases] = useState([])
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setLoading(false)
    const { data: advocate } = await supabase.from('advocates').select('id').eq('user_id', user.id).single()
    if (!advocate) return setLoading(false)
    const [caseResult, billResult] = await Promise.all([
      supabase.from('cases').select('id, case_type, status, created_at, updated_at').eq('advocate_id', advocate.id),
      supabase.from('billing').select('fee_amount, fee_status, paid_date, created_at'),
    ])
    if (caseResult.error) toast.error(caseResult.error.message)
    if (billResult.error && billResult.error.code !== '42P01') toast.error(billResult.error.message)
    setCases(caseResult.data || [])
    setBills(billResult.data || [])
    setLoading(false)
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  const report = useMemo(() => {
    const decided = cases.filter(item => isWon(item.status) || isLost(item.status))
    const won = decided.filter(item => isWon(item.status)).length
    const lost = decided.filter(item => isLost(item.status)).length
    const durations = cases.filter(item => isClosed(item.status)).map(item => Math.max(1, (new Date(item.updated_at).getTime() - new Date(item.created_at).getTime()) / 86400000))
    const averageDays = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0
    const byType = Object.values(cases.reduce((result, item) => { const name = item.case_type || 'Other'; if (!result[name]) result[name] = { name, won: 0, lost: 0 }; if (isWon(item.status)) result[name].won += 1; if (isLost(item.status)) result[name].lost += 1; return result }, {})).map(item => ({ ...item, successRate: item.won + item.lost ? Math.round((item.won / (item.won + item.lost)) * 100) : 0 }))
    const months = [...Array(6)].map((_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (5 - index), 1); return monthKey(date) })
    const trends = months.map(key => ({ month: monthLabel(key), revenue: bills.filter(bill => bill.fee_status === 'Paid' && monthKey(bill.paid_date || bill.created_at) === key).reduce((sum, bill) => sum + Number(bill.fee_amount || 0), 0), cases: cases.filter(item => monthKey(item.created_at) === key).length }))
    return { won, lost, decided: decided.length, averageDays, byType, trends }
  }, [bills, cases])

  if (loading) return <div className="grid gap-4 md:grid-cols-2"><div className="h-32 animate-pulse rounded-2xl bg-slate-100" /><div className="h-32 animate-pulse rounded-2xl bg-slate-100" /></div>
  return <div className="mx-auto max-w-6xl"><div className="mb-6"><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><BarChart3 className="h-6 w-6 text-blue-600" />Practice Analytics</h1><p className="mt-1 text-sm text-slate-500">Outcomes, case mix, fee collection and recent activity.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Trophy} label="Success rate" value={report.decided ? `${Math.round((report.won / report.decided) * 100)}%` : 'No decided cases'} tone="blue" /><Metric icon={Trophy} label="Won / Lost" value={`${report.won} / ${report.lost}`} tone="green" /><Metric icon={CalendarClock} label="Average case duration" value={report.averageDays ? `${report.averageDays} days` : 'No closed cases'} tone="orange" /><Metric icon={CircleDollarSign} label="Revenue, last 6 months" value={money(report.trends.reduce((sum, item) => sum + item.revenue, 0))} tone="purple" /></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><ChartCard title="Cases won vs lost"><ResponsiveContainer width="100%" height={270}><PieChart><Pie data={[{ name: 'Won', value: report.won }, { name: 'Lost', value: report.lost }].filter(item => item.value)} dataKey="value" nameKey="name" outerRadius={90} label>{COLORS.map((color) => <Cell key={color} fill={color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>{!report.decided && <ChartEmpty text="Add a final Won or Lost status to closed cases to see this ratio." />}</ChartCard><ChartCard title="Success rate by case type"><ResponsiveContainer width="100%" height={270}><BarChart data={report.byType}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis unit="%" domain={[0, 100]} /><Tooltip /><Bar dataKey="successRate" name="Success rate" fill="#2563eb" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>{!report.byType.length && <ChartEmpty text="Case-type analytics will appear after cases are added." />}</ChartCard><ChartCard title="Monthly revenue"><ResponsiveContainer width="100%" height={270}><BarChart data={report.trends}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis tickFormatter={value => `\u20B9${value}`} /><Tooltip formatter={value => money(value)} /><Bar dataKey="revenue" name="Collected fees" fill="#16a34a" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Recent case trend"><ResponsiveContainer width="100%" height={270}><LineChart data={report.trends}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="cases" name="New cases" stroke="#9333ea" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></ChartCard></div></div>
}

function Metric({ icon: Icon, label, value, tone }) { const tones = { blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', orange: 'bg-orange-50 text-orange-700', purple: 'bg-violet-50 text-violet-700' }; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div> }
function ChartCard({ title, children }) { return <section className="relative min-h-[330px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-2 font-bold text-slate-900">{title}</h2>{children}</section> }
function ChartEmpty({ text }) { return <p className="absolute inset-x-5 bottom-5 text-center text-xs text-slate-400">{text}</p> }
