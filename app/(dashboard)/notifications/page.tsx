import NotificationCenter from '@/src/components/NotificationCenter'
import NotificationPreferencePanel from '@/src/components/NotificationPreferencePanel'

export default function NotificationsPage() {
  return <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2"><NotificationCenter /><NotificationPreferencePanel /></div>
}
