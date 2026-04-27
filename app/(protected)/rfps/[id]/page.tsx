import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import WorkspaceClient from './WorkspaceClient'

export const dynamic = 'force-dynamic'

export default async function RfpWorkspacePage({ params }: { params: { id: string } }) {
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
  if (!session) return notFound()

  const { data: project } = await supabase
    .from('rfp_projects')
    .select('id, name, client_name, project_type, due_date, status')
    .eq('id', params.id)
    .single()

  if (!project) return notFound()

  const { data: questions } = await supabase
    .from('rfp_questions')
    .select('id, question_text, section_context, status, draft_text, assigned_to, due_date')
    .eq('project_id', params.id)
    .order('created_at', { ascending: true })

  // Fetch assignee names for questions that have assigned_to
  const assigneeIds = Array.from(
    new Set(
      (questions ?? [])
        .map((q: { assigned_to: string | null }) => q.assigned_to)
        .filter(Boolean) as string[]
    )
  )

  const assigneeMap: Record<string, string> = {}
  if (assigneeIds.length > 0) {
    const { data: assignees } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', assigneeIds)
    for (const a of (assignees ?? []) as { id: string; full_name: string }[]) {
      assigneeMap[a.id] = a.full_name
    }
  }

  // Fetch comments (approval_events with action='comment') for all questions
  const questionIds = (questions ?? []).map((q: { id: string }) => q.id)
  const commentMap: Record<string, { id: string; author_name: string; body: string; created_at: string }[]> = {}
  if (questionIds.length > 0) {
    const { data: events } = await supabase
      .from('approval_events')
      .select('id, entity_id, note, created_at, actor_id')
      .eq('entity_type', 'rfp_question')
      .eq('action', 'comment')
      .in('entity_id', questionIds)
      .order('created_at', { ascending: true })

    const actorIds = Array.from(new Set((events ?? []).map((e: { actor_id: string }) => e.actor_id)))
    const actorMap: Record<string, string> = {}
    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', actorIds)
      for (const a of (actors ?? []) as { id: string; full_name: string }[]) {
        actorMap[a.id] = a.full_name
      }
    }

    for (const e of (events ?? []) as { id: string; entity_id: string; actor_id: string; note: string; created_at: string }[]) {
      if (!commentMap[e.entity_id]) commentMap[e.entity_id] = []
      commentMap[e.entity_id].push({
        id: e.id,
        author_name: actorMap[e.actor_id] ?? 'Unknown',
        body: e.note ?? '',
        created_at: e.created_at,
      })
    }
  }

  type QuestionStatus = 'unanswered' | 'drafted' | 'in_review' | 'approved' | 'rejected'

  const enrichedQuestions = (questions ?? []).map((q: {
    id: string
    question_text: string
    section_context: string | null
    status: QuestionStatus
    draft_text: string | null
    assigned_to: string | null
    due_date: string | null
  }) => ({
    ...q,
    assigned_to_name: q.assigned_to ? (assigneeMap[q.assigned_to] ?? null) : null,
    comments: commentMap[q.id] ?? [],
  }))

  return (
    <WorkspaceClient
      project={project as { id: string; name: string; client_name: string | null; project_type: string | null; due_date: string | null; status: string }}
      questions={enrichedQuestions}
    />
  )
}
