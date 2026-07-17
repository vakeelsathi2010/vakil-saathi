/* eslint-disable @typescript-eslint/no-require-imports */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type AutoCreateResult = Record<string, unknown> & { updated: boolean }

const { autoCreateCase, AutoCreateError } = require('../../../../backend/functions/autoCreateCase') as {
  autoCreateCase: (supabase: Awaited<ReturnType<typeof createClient>>, body: Record<string, unknown>, userId: string) => Promise<AutoCreateResult>
  AutoCreateError: new (message: string, statusCode?: number) => Error & { statusCode?: number }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in is required', statusCode: 401 }, { status: 401 })
    }

    const result = await autoCreateCase(supabase, body, session.user.id)
    return NextResponse.json(result, { status: result.updated === true ? 200 : 201 })
  } catch (error) {
    const statusCode = error instanceof AutoCreateError ? error.statusCode || 400 : 500
    const message = error instanceof Error ? error.message : 'Unable to auto-create case'
    return NextResponse.json({ success: false, error: message, statusCode }, { status: statusCode })
  }
}
