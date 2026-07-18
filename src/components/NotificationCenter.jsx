'use client'

import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications } from '@/src/hooks/useNotifications'

export default function NotificationCenter() {
  const { events, unreadCount, loading, markRead } = useNotifications()
  return <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-gray-900"><Bell className="h-5 w-5 text-blue-600" />Notification Center</h2><span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">{unreadCount} unread</span></div>{loading ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-gray-100" /> : events.length ? <div className="mt-4 divide-y divide-gray-100">{events.map(event => <button type="button" key={event.id} onClick={() => event.status !== 'read' && markRead(event.id)} className={`block w-full py-3 text-left ${event.status !== 'read' ? 'font-semibold' : ''}`}><p className="text-sm text-gray-900">{event.title}</p><p className="mt-1 text-xs text-gray-500">{event.body}</p><p className="mt-1 text-[11px] text-gray-400">{new Date(event.created_at).toLocaleString('en-IN')}</p></button>)}</div> : <div className="py-8 text-center text-sm text-gray-500"><CheckCheck className="mx-auto mb-2 h-7 w-7 text-green-600" />No notifications yet.</div>}</section>
}
