import { format, parseISO, differenceInDays } from 'date-fns'

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateHindi(dateStr: string): string {
  try {
    const d = parseISO(dateStr)
    return format(d, 'dd/MM/yyyy')
  } catch {
    return dateStr
  }
}

export function daysUntilHearing(dateStr: string): number {
  try {
    return differenceInDays(parseISO(dateStr), new Date())
  } catch {
    return 0
  }
}

export function getHearingUrgency(dateStr: string): 'today' | 'tomorrow' | 'soon' | 'upcoming' | 'past' {
  const days = daysUntilHearing(dateStr)
  if (days < 0) return 'past'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 7) return 'soon'
  return 'upcoming'
}

export function urgencyColor(urgency: string): string {
  switch (urgency) {
    case 'today': return 'bg-red-100 text-red-800 border-red-200'
    case 'tomorrow': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'soon': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'past': return 'bg-gray-100 text-gray-500 border-gray-200'
    default: return 'bg-blue-100 text-blue-800 border-blue-200'
  }
}

export function urgencyLabel(urgency: string): string {
  switch (urgency) {
    case 'today': return '⚠️ Today'
    case 'tomorrow': return '🔔 Tomorrow'
    case 'soon': return '📅 Soon'
    case 'past': return '✓ Completed'
    default: return '📋 Upcoming'
  }
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
