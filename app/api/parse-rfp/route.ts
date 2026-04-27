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

  // Batch insert questions
  const questionRows = questions.map((q) => ({
    project_id: project.id,
    question_text: q.question_text,
    section_context: q.section_context || null,
    status: 'unanswered' as const,
  }))

  const { error: qError } = await supabase.from('rfp_questions').insert(questionRows)
  if (qError) {
    console.error('questions insert error', qError)
    return NextResponse.json({ error: qError.message }, { status: 500 })
  }

  // Audit log
  await supabase.from('approval_events').insert({
    entity_type: 'rfp_project',
    entity_id: project.id,
    action: 'create',
    actor_id: session.user.id,
    note: `Parsed ${questions.length} questions from ${file?.name ?? 'pasted text'}`,
  })

  return NextResponse.json({
    project_id: project.id,
    questions_parsed: questions.length,
    questions: questions.map((q) => ({
      question_text: q.question_text,
      section_context: q.section_context,
    })),
  })
}
