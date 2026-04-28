'use client'

import { useState } from 'react'

type QuestionStatus = 'unanswered' | 'drafted' | 'in_review' | 'approved' | 'rejected'

export type Comment = {
  id: string
  author_name: string
  body: string
  created_at: string
}

export type WorkflowMeta = {
  assignee_name: string | null
  assignee_id: string | null
  status: QuestionStatus
  due_date: string | null
  comments: Comment[]
  section_context: string | null
  available_sections: string[]
}

const STATUS_OPTIONS: { value: QuestionStatus; label: string }[] = [
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'drafted', label: 'Drafted' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function WorkflowSidebar({
  meta,
  onStatusChange,
  onSectionChange,
  onAccept,
  onReject,
  onPostComment,
}: {
  meta: WorkflowMeta
  onStatusChange: (status: QuestionStatus) => void
  onSectionChange: (section: string | null) => void
  onAccept: () => void
  onReject: () => void
  onPostComment: (body: string) => void
}) {
  const [commentBody, setCommentBody] = useState('')

  function handlePost() {
    if (!commentBody.trim()) return
    onPostComment(commentBody.trim())
    setCommentBody('')
  }

  return (
    <div className="w-64 flex-shrink-0 border-l border-[#E2E8F0] flex flex-col bg-[#F5F7FA]">
      <div className="px-4 py-4 border-b border-[#E2E8F0] space-y-4">
        <div>
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">Assignee</p>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-[#1B3A5C] text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
              {initials(meta.assignee_name)}
            </span>
            <span className="text-sm text-[#1A1A2E]">{meta.assignee_name ?? 'Unassigned'}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">Status</p>
          <select
            value={meta.status}
            onChange={(e) => onStatusChange(e.target.value as QuestionStatus)}
            className="w-full text-sm border border-[#E2E8F0] rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E7D9A] text-[#1A1A2E]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">Section</p>
          <select
            value={meta.section_context ?? ''}
            onChange={(e) => onSectionChange(e.target.value || null)}
            className="w-full text-sm border border-[#E2E8F0] rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#2E7D9A] text-[#1A1A2E]"
          >
            <option value="">Uncategorized</option>
            {meta.available_sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {meta.due_date && (
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Due Date</p>
            <p className="text-sm text-[#1A1A2E]">
              {new Date(meta.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onReject}
            className="flex-1 py-1.5 text-xs font-medium rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-1.5 text-xs font-medium rounded border border-green-400 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
        <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">
          Internal Comments
        </p>

        <div className="flex-1 space-y-3 overflow-y-auto mb-4">
          {meta.comments.length === 0 ? (
            <p className="text-xs text-[#6B7280]">No comments yet.</p>
          ) : (
            meta.comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2E7D9A] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {initials(c.author_name)}
                </span>
                <div>
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-[#1A1A2E]">{c.author_name}</span>
                    <span className="text-[10px] text-[#6B7280]">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-[#1A1A2E] leading-relaxed">{c.body}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-auto">
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={3}
            placeholder="Add a comment..."
            className="w-full text-xs border border-[#E2E8F0] rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#2E7D9A] bg-white"
          />
          <button
            onClick={handlePost}
            disabled={!commentBody.trim()}
            className="mt-1.5 w-full py-1.5 text-xs font-medium rounded bg-[#1B3A5C] text-white hover:bg-[#162f4a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Post Comment
          </button>
        </div>
      </div>
    </div>
  )
}
