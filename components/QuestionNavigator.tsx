'use client'

import { useState } from 'react'
import StatusBadge from './StatusBadge'

type QuestionStatus = 'unanswered' | 'drafted' | 'in_review' | 'approved' | 'rejected'

export type NavQuestion = {
  id: string
  question_text: string
  section_context: string | null
  status: QuestionStatus
  assigned_to_name: string | null
}

type FilterTab = 'all' | 'unanswered' | 'in_review' | 'approved'

const tabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unanswered', label: 'Unanswered' },
  { key: 'in_review', label: 'In Review' },
  { key: 'approved', label: 'Approved' },
]

function filterByTab(questions: NavQuestion[], tab: FilterTab): NavQuestion[] {
  if (tab === 'all') return questions
  if (tab === 'unanswered') return questions.filter((q) => q.status === 'unanswered')
  if (tab === 'in_review') return questions.filter((q) => q.status === 'in_review')
  if (tab === 'approved') return questions.filter((q) => q.status === 'approved')
  return questions
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function QuestionNavigator({
  questions,
  activeId,
  onSelect,
}: {
  questions: NavQuestion[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const [tab, setTab] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  const filtered = filterByTab(questions, tab).filter((q) =>
    search.trim() === '' ? true : q.question_text.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="w-72 flex-shrink-0 border-r border-[#E2E8F0] flex flex-col bg-white">
      <div className="px-4 pt-4 pb-2">
        <input
          type="text"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-[#E2E8F0] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2E7D9A] placeholder-[#9CA3AF]"
        />
      </div>

      <div className="flex border-b border-[#E2E8F0] px-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[#2E7D9A] text-[#2E7D9A]'
                : 'border-transparent text-[#6B7280] hover:text-[#1A1A2E]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-[#6B7280] text-center py-8">No questions found.</p>
        ) : (
          filtered.map((q, idx) => {
            const isActive = q.id === activeId
            return (
              <button
                key={q.id}
                onClick={() => onSelect(q.id)}
                className={`w-full text-left px-4 py-3 border-b border-[#E2E8F0] transition-colors group ${
                  isActive
                    ? 'bg-[#EBF5FA] border-l-2 border-l-[#2E7D9A] pl-[14px]'
                    : 'hover:bg-[#F5F7FA] border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#6B7280]">Q{idx + 1}</span>
                  <StatusBadge status={q.status} />
                </div>
                <p className="text-sm text-[#1A1A2E] line-clamp-2 leading-snug mb-2">
                  {q.question_text}
                </p>
                <div className="flex items-center justify-between">
                  {q.section_context && (
                    <span className="text-xs text-[#6B7280] bg-[#F5F7FA] px-2 py-0.5 rounded truncate max-w-[120px]">
                      {q.section_context}
                    </span>
                  )}
                  {q.assigned_to_name && (
                    <span className="ml-auto w-5 h-5 rounded-full bg-[#2E7D9A] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                      {initials(q.assigned_to_name)}
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
