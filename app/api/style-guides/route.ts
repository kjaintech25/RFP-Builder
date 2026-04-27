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
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id: string; action: 'approve' | 'toggle_active' | 'reject' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, action } = body
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

  // Fetch current state
  const { data: guide, error: fetchErr } = await supabase
    .from('style_guides')
    .select('id, approval_status, is_active')
    .eq('id', id)
    .single()

  if (fetchErr || !guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let patch: Record<string, unknown> = {}
  let auditAction = ''

  if (action === 'approve') {
    if (guide.approval_status === 'approved') {
      return NextResponse.json({ error: 'Already approved' }, { status: 400 })
    }
    patch = { approval_status: 'approved', approved_by: session.user.id, approved_at: new Date().toISOString() }
    auditAction = 'approved'
  } else if (action === 'reject') {
    patch = { approval_status: 'rejected', is_active: false }
    auditAction = 'rejected'
  } else if (action === 'toggle_active') {
    if (guide.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Must be approved before activating' }, { status: 400 })
    }
    patch = { is_active: !guide.is_active }
    auditAction = guide.is_active ? 'deactivated' : 'activated'
  }

  const { error: updateErr } = await supabase
    .from('style_guides')
    .update(patch)
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await supabase.from('approval_events').insert({
    entity_type: 'style_guide',
    entity_id: id,
    action: auditAction,
    actor_id: session.user.id,
  })

  return NextResponse.json({ ok: true })
}
