export type ResearchType = 'judgment' | 'section' | 'argument' | 'note'

export interface ResearchEntry {
  id: string
  type: ResearchType
  title: string
  citation?: string
  court?: string
  decision_date?: string
  source_url?: string
  proposition?: string
  advocate_note?: string
  tags: string[]
  created_at: string
}

export interface ResearchMetadata {
  research_library?: ResearchEntry[]
  acts_sections?: string
  matter_nature?: string
  [key: string]: unknown
}

export function parseResearchMetadata(notes?: string | null): ResearchMetadata {
  if (!notes) return { research_library: [] }
  try {
    const parsed = JSON.parse(notes) as ResearchMetadata
    return {
      ...parsed,
      research_library: Array.isArray(parsed.research_library)
        ? parsed.research_library.filter(entry => entry && typeof entry.title === 'string')
        : [],
    }
  } catch {
    return { legacy_notes: notes, research_library: [] }
  }
}

export function indianKanoonSearchUrl(query: string) {
  return `https://indiankanoon.org/search/?formInput=${encodeURIComponent(query.trim())}`
}

export function isSafeSourceUrl(value: string) {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

