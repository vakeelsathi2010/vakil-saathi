export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type AssigneeRole = 'Junior Advocate' | 'Clerk' | 'Intern' | 'Self' | 'Other'

export interface PracticeTask {
  id: string
  title: string
  description?: string
  assignee_name: string
  assignee_role: AssigneeRole
  assignee_phone?: string
  due_date: string
  priority: TaskPriority
  status: TaskStatus
  created_at: string
  completed_at?: string
  completion_note?: string
}

export interface TaskMetadata {
  practice_tasks?: PracticeTask[]
  [key: string]: unknown
}

export function parseTaskMetadata(notes?: string | null): TaskMetadata {
  if (!notes) return { practice_tasks: [] }
  try {
    const parsed = JSON.parse(notes) as TaskMetadata
    return {
      ...parsed,
      practice_tasks: Array.isArray(parsed.practice_tasks)
        ? parsed.practice_tasks.filter(task => task && typeof task.title === 'string' && typeof task.assignee_name === 'string')
        : [],
    }
  } catch {
    return { legacy_notes: notes, practice_tasks: [] }
  }
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function taskTiming(task: PracticeTask, today = localDateKey()) {
  if (task.status === 'completed') return 'completed'
  if (task.due_date < today) return 'overdue'
  if (task.due_date === today) return 'today'
  return 'upcoming'
}

export function normalizedIndianPhone(value?: string) {
  const digits = String(value || '').replace(/\D/g, '')
  const local = digits.length > 10 ? digits.slice(-10) : digits
  return /^[6-9]\d{9}$/.test(local) ? `91${local}` : ''
}

export function taskWhatsAppUrl(task: PracticeTask, caseNumber: string, isHindi: boolean) {
  const phone = normalizedIndianPhone(task.assignee_phone)
  if (!phone) return ''
  const message = isHindi
    ? `VakilSaathi कार्य\nकेस: ${caseNumber}\nकार्य: ${task.title}\nजिम्मेदारी: ${task.assignee_name} (${task.assignee_role})\nअंतिम तिथि: ${task.due_date}\nप्राथमिकता: ${task.priority}${task.description ? `\nनिर्देश: ${task.description}` : ''}`
    : `VakilSaathi Task\nCase: ${caseNumber}\nTask: ${task.title}\nAssigned to: ${task.assignee_name} (${task.assignee_role})\nDue: ${task.due_date}\nPriority: ${task.priority}${task.description ? `\nInstructions: ${task.description}` : ''}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

