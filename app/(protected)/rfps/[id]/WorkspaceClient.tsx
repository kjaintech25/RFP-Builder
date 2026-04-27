'use client'

import { useState, useCallback } from 'react'
import QuestionNavigator, { NavQuestion } from '@/components/QuestionNavigator'
import QuestionDetailView, { QuestionDetail, SourceChunk } from '@/components/QuestionDetailView'
import WorkflowSidebar, { WorkflowMeta, Comment } from '@/components/WorkflowSidebar'
import StatusBadge from '@/components/StatusBadge'

type QuestionStatus = 'unanswered' | 'drafted' | 'in_review' | 'approved' | 'rejected'

type EnrichedQuestion = {
  id: string
  question_text: string
  section_context: string | null
  status: QuestionStatus
  draft_text: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  due_date: string | null
  comments: Comment[]
}

type Project = {
  id: string
  name: string
  client_name: string | null
  project_type: string | null
  due_date: string | null
  status: string
}

export default function WorkspaceClient({
  project,
  questions: initialQuestions,
}: {
  project: Project
  questions: EnrichedQuestion[]
}) {
  const [questions, setQuestions] = useState<EnrichedQuestion[]>(initialQuestions)
  const [activeId, setActiveId] = useState<string | null>(initialQuestions[0]?.id ?? null)
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const q of initialQuestions) {
      if (q.draft_text) m[q.id] = q.draft_text
    }
    return m
  })
  const [sources] = useState<Record<string, SourceChunk[]>>({})

  const activeQuestion = questions.find((q) => q.id === activeId) ?? null

  const navQuestions: NavQuestion[] = questions.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    section_context: q.section_context,
    status: q.status,
    assigned_to_name: q.assigned_to_name,
  }))

  const activeDetail: QuestionDetail | null = activeQuestion
    ? {
        id: activeQuestion.id,
        question_text: activeQuestion.question_text,
        section_context: activeQuestion.section_context,
        draft_text: drafts[activeQuestion.id] ?? activeQuestion.draft_text,
        status: activeQuestion.status,
        sources: sources[activeQuestion.id] ?? [],
      }
    : null

  const activeMeta: WorkflowMeta | null = activeQuestion
    ? {
        assignee_name: activeQuestion.assigned_to_name,
        assignee_id: activeQuestion.assigned_to,
        status: activeQuestion.status,
        due_date: activeQuestion.due_date,
        comments: activeQuestion.comments,
      }
    : null

  const handleDraftChange = useCallback((id: string, draft: string) => {
    setDrafts((prev) => ({ ...prev, [id]: draft }))
    // Debounced persist — fire and forget; errors don't block UX
    fetch('/api/update-question', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: id, draft_text: draft }),
    }).catch(() => {})
  }, [])

  const handleGenerateDraft = useCallback(
    async (id: string) => {
      const q = questions.find((q) => q.id === id)
      if (!q) return
      setGenerating(true)
      try {
        const res = await fetch('/api/generate-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question_id: id, question_text: q.question_text }),
        })
        if (!res.ok) return
        const data = await res.json() as { draft: string; source_answer_ids: string[] }
        setDrafts((prev) => ({ ...prev, [id]: data.draft }))
        setQuestions((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, status: data.draft.startsWith('INSUFFICIENT_CONTEXT') ? 'unanswered' : 'drafted' }
              : p
          )
        )
      } finally {
        setGenerating(false)
      }
    },
    [questions]
  )

  const handleStatusChange = useCallback(
    async (status: QuestionStatus) => {
      if (!activeId) return
      setQuestions((prev) =>
        prev.map((q) => (q.id === activeId ? { ...q, status } : q))
      )
      await fetch('/api/update-question', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: activeId, status }),
      }).catch(() => {})
    },
    [activeId]
  )

  const handleAccept = useCallback(() => handleStatusChange('approved'), [handleStatusChange])
  const handleReject = useCallback(() => handleStatusChange('rejected'), [handleStatusChange])

  const handlePostComment = useCallback(
    async (body: string) => {
      if (!activeId) return
      const res = await fetch('/api/post-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: activeId, body }),
      }).catch(() => null)
      if (!res?.ok) return
      const comment = await res.json() as Comment
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === activeId ? { ...q, comments: [...q.comments, comment] } : q
        )
      )
    },
    [activeId]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Project header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#E2E8F0] bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-semibold text-[#1B3A5C] leading-tight">{project.name}</h1>
            <p className="text-xs text-[#6B7280]">
              {project.client_name && <span>{project.client_name}</span>}
              {project.client_name && project.project_type && <span> · </span>}
              {project.project_type && <span>{project.project_type}</span>}
              {project.due_date && (
                <span> · Due {new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
            </p>
          </div>
          <StatusBadge status={project.status as Parameters<typeof StatusBadge>[0]['status']} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#6B7280]">
            {questions.filter((q) => q.status === 'approved').length} / {questions.length} approved
          </span>
          <div className="w-32 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{
                width: questions.length
                  ? `${(questions.filter((q) => q.status === 'approved').length / questions.length) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      </div>

      {/* 3-panel workspace */}
      <div className="flex flex-1 overflow-hidden">
        <QuestionNavigator
          questions={navQuestions}
          activeId={activeId}
          onSelect={setActiveId}
        />

        {activeDetail ? (
          <QuestionDetailView
            question={activeDetail}
            onDraftChange={handleDraftChange}
            onGenerateDraft={handleGenerateDraft}
            generating={generating}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#6B7280] text-sm bg-white">
            {questions.length === 0
              ? 'No questions in this project.'
              : 'Select a question to begin.'}
          </div>
        )}

        {activeMeta && (
          <WorkflowSidebar
            meta={activeMeta}
            onStatusChange={handleStatusChange}
            onAccept={handleAccept}
            onReject={handleReject}
            onPostComment={handlePostComment}
          />
        )}
      </div>

      {/* Bottom action bar */}
      {activeId && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#E2E8F0] bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerateDraft(activeId)}
              disabled={generating}
              className="text-sm px-3 py-1.5 rounded border border-[#E2E8F0] text-[#1A1A2E] hover:bg-[#F5F7FA] transition-colors disabled:opacity-50"
            >
              Edit Draft
            </button>
            <button className="text-sm px-3 py-1.5 rounded border border-[#E2E8F0] text-[#1A1A2E] hover:bg-[#F5F7FA] transition-colors">
              Flag
            </button>
            <button className="text-sm px-3 py-1.5 rounded border border-[#E2E8F0] text-[#1A1A2E] hover:bg-[#F5F7FA] transition-colors">
              Reassign
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              className="text-sm px-4 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={handleAccept}
              className="text-sm px-4 py-1.5 rounded bg-[#2E7D9A] text-white hover:bg-[#256882] transition-colors font-medium"
            >
              Accept Answer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
