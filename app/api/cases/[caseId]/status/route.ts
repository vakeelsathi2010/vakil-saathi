/* eslint-disable @typescript-eslint/no-require-imports */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const { updateCaseStatus } = require('../../../../../backend/routes/status') as {
  updateCaseStatus: (supabase: Awaited<ReturnType<typeof createClient>>, userId: string, caseId: string, body: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export async function PUT(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await context.params
    const body = await request.json() as Record<string, unknown>
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ success: false, error: 'Sign in is required', statusCode: 401 }, { status: 401 })
    const result = await updateCaseStatus(supabase, session.user.id, caseId, body)
    return NextResponse.json(result)
  } catch (error) {
    const status = error instanceof Error && 'statusCode' in error ? Number(error.statusCode) || 400 : 500
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to update case status', statusCode: status }, { status })
  }
}
