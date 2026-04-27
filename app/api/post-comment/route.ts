import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
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

  let body: { question_id: string; body: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { question_id, body: commentBody } = body
  if (!question_id || !commentBody?.trim()) {
    return NextResponse.json({ error: 'question_id and body required' }, { status: 400 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', session.user.id)
    .single()

  const { error } = await supabase.from('approval_events').insert({
    entity_type: 'rfp_question',
    entity_id: question_id,
    action: 'comment',
    actor_id: session.user.id,
    note: commentBody.trim(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    id: crypto.randomUUID(),
    author_name: (userRow as { full_name: string } | null)?.full_name ?? session.user.email ?? 'Unknown',
    body: commentBody.trim(),
    created_at: new Date().toISOString(),
  })
}
