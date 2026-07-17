import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// The parser stays server-side so its extraction rules can evolve without
// exposing implementation details to the browser.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extractCaseDetails } = require('../../../../backend/functions/caseExtraction') as {
  extractCaseDetails: (text: string) => Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in is required', statusCode: 401 }, { status: 401 })
    }

    const { transcript } = await request.json() as { transcript?: unknown }
    const details = extractCaseDetails(typeof transcript === 'string' ? transcript : '')
    if ('error' in details) {
      return NextResponse.json({ success: false, error: details.error, statusCode: 400 }, { status: 400 })
    }
    return NextResponse.json({ success: true, details })
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to analyse the voice note', statusCode: 500 }, { status: 500 })
  }
}
