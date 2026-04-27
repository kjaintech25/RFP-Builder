import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generateDraft, StyleGuide } from '@/lib/ai'

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

  let body: { question_id: string; question_text: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { question_id, question_text } = body
  if (!question_id || !question_text) {
    return NextResponse.json({ error: 'question_id and question_text required' }, { status: 400 })
  }

  // Fetch approved + active style guides — these shape how the AI writes
  const { data: rawGuides } = await supabase
    .from('style_guides')
    .select('name, type, content')
    .eq('approval_status', 'approved')
    .eq('is_active', true)
    .order('type', { ascending: true }) // voice → format → compliance → firm_context

  const styleGuides: StyleGuide[] = (rawGuides ?? []).map(
    (g: { name: string; type: string; content: string }) => ({
      name: g.name,
      type: g.type as StyleGuide['type'],
      content: g.content,
    })
  )

  // Fetch approved answers (MVP: keyword retrieval; full path: embed → match_answers RPC)
  const { data: answers, error: matchErr } = await supabase
    .from('answers')
    .select('id, question_text, answer_text')
    .eq('approval_status', 'approved')
    .limit(5)

  if (matchErr) {
    return NextResponse.json({ error: matchErr.message }, { status: 500 })
  }

  const retrievedChunks = (answers ?? []).map(
    (a: { id: string; question_text: string; answer_text: string }) => ({
      answer_id: a.id,
      question_text: a.question_text,
      answer_text: a.answer_text,
      similarity: 1,
    })
  )

  const result = await generateDraft(question_text, retrievedChunks, styleGuides)

  // Persist draft
  await supabase
    .from('rfp_questions')
    .update({
      draft_text: result.draft,
      matched_answer_id: result.source_answer_ids[0] ?? null,
      status: result.draft.startsWith('INSUFFICIENT_CONTEXT') ? 'unanswered' : 'drafted',
    })
    .eq('id', question_id)

  // Audit: record which style guides and source answers were used
  await supabase.from('approval_events').insert({
    entity_type: 'rfp_question',
    entity_id: question_id,
    action: 'draft_generated',
    actor_id: session.user.id,
    note: [
      `Sources: ${result.source_answer_ids.join(', ') || 'none'}`,
      styleGuides.length > 0
        ? `Style guides applied: ${styleGuides.map((g) => g.name).join(', ')}`
        : 'No style guides active',
    ].join(' | '),
  })

  return NextResponse.json(result)
}
