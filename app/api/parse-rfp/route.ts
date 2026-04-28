import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { parseDocument } from '@/lib/parser'

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

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const text = formData.get('text') as string | null
  const name = (formData.get('name') as string | null)?.trim()
  const clientName = (formData.get('client_name') as string | null)?.trim() ?? null
  const projectType = (formData.get('project_type') as string | null)?.trim() ?? null
  const dueDate = (formData.get('due_date') as string | null)?.trim() ?? null

  if (!name) {
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
  }

  if (!file && (!text || text.trim().length === 0)) {
    return NextResponse.json({ error: 'Provide a file or pasted text' }, { status: 400 })
  }

  // Parse questions
  let questions
  try {
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer())
      questions = await parseDocument(buffer, file.type, file.name)
    } else {
      questions = await parseDocument(
        Buffer.from((text ?? '').trim(), 'utf-8'),
        'text/plain',
        'pasted.txt'
      )
    }
  } catch (err) {
    console.error('parse error', err)
    return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 })
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { error: 'No questions detected in the uploaded content. Try pasting the text instead.' },
      { status: 422 }
    )
  }

  // Create project
  const { data: project, error: projectError } = await supabase
    .from('rfp_projects')
    .insert({
      name,
      client_name: clientName,
      project_type: projectType,
      due_date: dueDate,
      status: 'active',
      created_by: session.user.id,
    })
    .select('id')
    .single()

  if (projectError) {
    console.error('project insert error', projectError)
    return NextResponse.json({ error: projectError.message }, { status: 500 })
  }

  // Pass 1: insert top-level questions, get back their UUIDs
  const parentQuestions = questions.filter((q) => !q.parent_id)
  const childQuestions = questions.filter((q) => q.parent_id != null)

  const parentRows = parentQuestions.map((q) => ({
    project_id: project.id,
    question_text: q.question_text,
    section_context: q.section_context || null,
    order_index: q.order_index,
    status: 'unanswered' as const,
  }))

  const { data: insertedParents, error: parentError } = await supabase
    .from('rfp_questions')
    .insert(parentRows)
    .select('id, order_index')

  if (parentError) {
    console.error('parent insert error', parentError)
    return NextResponse.json({ error: parentError.message }, { status: 500 })
  }

  // Build order_index → real UUID map
  const orderToId = new Map<number, string>()
  for (const p of (insertedParents ?? [])) {
    orderToId.set(p.order_index, p.id)
  }

  // Pass 2: insert sub-questions with resolved parent UUIDs
  if (childQuestions.length > 0) {
    const childRows = childQuestions.map((q) => ({
      project_id: project.id,
      question_text: q.question_text,
      section_context: q.section_context || null,
      order_index: q.order_index,
      status: 'unanswered' as const,
      parent_id: orderToId.get(parseInt(q.parent_id!)) ?? null,
    }))

    const { error: childError } = await supabase.from('rfp_questions').insert(childRows)
    if (childError) {
      console.error('child questions insert error', childError)
      // Non-fatal: project + parent questions are already saved
    }
  }

  const totalInserted = (insertedParents?.length ?? 0) + childQuestions.length

  // Audit log
  await supabase.from('approval_events').insert({
    entity_type: 'rfp_project',
    entity_id: project.id,
    action: 'create',
    actor_id: session.user.id,
    note: `Parsed ${totalInserted} questions (${parentQuestions.length} top-level, ${childQuestions.length} sub-questions) from ${file?.name ?? 'pasted text'}`,
  })

  return NextResponse.json({
    project_id: project.id,
    questions_parsed: totalInserted,
    questions: questions.map((q) => ({
      question_text: q.question_text,
      section_context: q.section_context,
    })),
  })
}
