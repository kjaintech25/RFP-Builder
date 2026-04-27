'use client'

import { useState, useCallback } from 'react'

export type SourceChunk = {
  answer_id: string
  similarity: number
  answer_text: string
  approved_by?: string | null
}

export type QuestionDetail = {
  id: string
  question_text: string
  section_context: string | null
  draft_text: string | null
  status: string
  is_stale?: boolean
  sources: SourceChunk[]
}

export default function QuestionDetailView({
  question,
  onDraftChange,
  onGenerateDraft,
  generating,
}: {
  question: QuestionDetail
  onDraftChange: (id: string, draft: string) => void
  onGenerateDraft: (id: string) => void
  generating: boolean
}) {
  const [localDraft, setLocalDraft] = useState(question.draft_text ?? '')
  const [showComparisons, setShowComparisons] = useState<Record<string, boolean>>({})

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalDraft(e.target.value)
      onDraftChange(question.id, e.target.value)
    },
    [question.id, onDraftChange]
  )

  const isInsufficient = localDraft.startsWith('INSUFFICIENT_CONTEXT')

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {question.is_stale && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          This answer may be stale — the source has been updated since this draft was generated.
        </div>
      )}

      <div className="px-6 pt-5 pb-4 border-b border-[#E2E8F0]">
        {question.section_context && (
          <p className="text-xs text-[#6B7280] mb-1 font-medium uppercase tracking-wide">
            {question.section_context}
          </p>
        )}
        <h2 className="text-base font-semibold text-[#1B3A5C] leading-snug">
          {question.question_text}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wide">
              Draft Response
            </label>
            <button
              onClick={() => onGenerateDraft(question.id)}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-[#2E7D9A] text-white hover:bg-[#256882] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <>
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Draft
                </>
              )}
            </button>
          </div>

          {isInsufficient ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Insufficient Context</p>
              <p>{localDraft.replace('INSUFFICIENT_CONTEXT:', '').trim()}</p>
            </div>
          ) : (
            <textarea
              value={localDraft}
              onChange={handleChange}
              rows={12}
              className="w-full text-sm border border-[#E2E8F0] rounded px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#2E7D9A] leading-relaxed text-[#1A1A2E]"
              placeholder="No draft yet — click Generate Draft to create one from approved answers."
            />
          )}
        </div>

        {question.sources.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wide mb-2">
              Source Citations
            </p>
            <div className="space-y-2">
              {question.sources.map((src) => {
                const pct = Math.round(src.similarity * 100)
                const expanded = showComparisons[src.answer_id]
                return (
                  <div
                    key={src.answer_id}
                    className="border border-[#E2E8F0] rounded p-3 bg-[#F5F7FA] text-sm"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs text-[#6B7280] truncate max-w-[200px]">
                        ID: {src.answer_id}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            pct >= 85
                              ? 'bg-green-100 text-green-700'
                              : pct >= 70
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {pct}% match
                        </span>
                        <button
                          onClick={() =>
                            setShowComparisons((prev) => ({
                              ...prev,
                              [src.answer_id]: !prev[src.answer_id],
                            }))
                          }
                          className="text-xs text-[#2E7D9A] hover:underline"
                        >
                          {expanded ? 'Hide' : 'Compare Versions'}
                        </button>
                      </div>
                    </div>
                    {src.approved_by && (
                      <p className="text-xs text-[#6B7280] mb-1.5">Approved by: {src.approved_by}</p>
                    )}
                    {expanded && (
                      <p className="text-xs text-[#1A1A2E] border-t border-[#E2E8F0] pt-2 mt-1 leading-relaxed">
                        {src.answer_text}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
