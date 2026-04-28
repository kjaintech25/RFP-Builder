import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request) {
  const cookieStore = cookies()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { question_id: string; draft_text?: string; status?: string; section_context?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { question_id, ...updates } = body
  if (!question_id) {
    return NextResponse.json({ error: 'question_id required' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (updates.draft_text !== undefined) patch.draft_text = updates.draft_text
  if (updates.status !== undefined) patch.status = updates.status
  if (updates.section_context !== undefined) patch.section_context = updates.section_context ?? null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('rfp_questions')
    .update(patch)
    .eq('id', question_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (updates.status) {
    await supabase.from('approval_events').insert({
      entity_type: 'rfp_question',
      entity_id: question_id,
      action: `status_changed_to_${updates.status}`,
      actor_id: session.user.id,
    })
  }

  return NextResponse.json({ ok: true })
}
