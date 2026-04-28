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
  parent_id: string | null
  order_index: number
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

function groupByParent(questions: NavQuestion[]): { parent: NavQuestion; children: NavQuestion[] }[] {
  // Group questions by parent_id
  const parentMap = new Map<string, NavQuestion>()
  const childrenMap = new Map<string, NavQuestion[]>()

  // First pass: separate parents and children
  for (const q of questions) {
    if (q.parent_id) {
      // This is a child question
      if (!childrenMap.has(q.parent_id)) {
        childrenMap.set(q.parent_id, [])
      }
      childrenMap.get(q.parent_id)!.push(q)
    } else {
      // This is a parent question
      parentMap.set(q.id, q)
    }
  }

  // Create parent-child pairs
  const result: { parent: NavQuestion; children: NavQuestion[] }[] = []

  // Add parent questions that have children
  for (const [parentId, children] of childrenMap) {
    const parent = parentMap.get(parentId)
    if (parent) {
      result.push({ parent, children })
      // Remove the parent from the parent map since we've handled it
      parentMap.delete(parentId)
    }
  }

  // Add remaining parent questions (those without children)
  for (const parent of parentMap.values()) {
    result.push({ parent, children: [] })
  }

  // Sort by order_index
  result.sort((a, b) => a.parent.order_index - b.parent.order_index)

  return result
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
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set())
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => new Set())

  const filtered = filterByTab(questions, tab).filter((q) =>
    search.trim() === '' ? true : q.question_text.toLowerCase().includes(search.toLowerCase())
  )

  const useGrouped = search.trim() === ''
  const parentGroups = useGrouped ? groupByParent(filtered) : null

  // Build a global index map so Q-numbers are sequential across all sections
  const globalIndexMap = new Map<string, number>()
  let idx = 0
  for (const q of filtered) {
    globalIndexMap.set(q.id, idx++)
  }

  function toggleSection(section: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  function isSectionOpen(section: string) {
    // Default: all sections open unless explicitly closed
    return !openSections.has(section)
  }

  function renderQuestion(q: NavQuestion, isChild = false) {
    const isActive = q.id === activeId
    const qNum = (globalIndexMap.get(q.id) ?? 0) + 1
    const isExpanded = expandedParents.has(q.id)
    const hasChildren = filtered.some(child => child.parent_id === q.id)

    return (
      <div key={q.id}>
        <button
          onClick={() => {
            if (hasChildren) {
              setExpandedParents(prev => {
                const next = new Set(prev)
                if (next.has(q.id)) next.delete(q.id)
                else next.add(q.id)
                return next
              })
            }
            onSelect(q.id)
          }}
          className={`w-full text-left px-${isChild ? '8' : '4'} py-3 border-b border-[#E2E8F0] transition-colors group ${
            isActive
              ? 'bg-[#EBF5FA] border-l-2 border-l-[#2E7D9A] pl-[isChild ? 18 : 14]px'
              : 'hover:bg-[#F5F7FA] border-l-2 border-l-transparent'
          }`}
          style={{ paddingLeft: isChild ? '2rem' : '1rem' }}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              {hasChildren && (
                <span className="text-xs text-[#6B7280] w-4">
                  {isExpanded ? '▼' : '▶'}
                </span>
              )}
              <span className="text-xs font-semibold text-[#6B7280]">
                {isChild ? 'Sub-Q' : 'Q'}{qNum}
              </span>
            </div>
            <StatusBadge status={q.status} />
          </div>
          <p className="text-sm text-[#1A1A2E] line-clamp-2 leading-snug mb-2">
            {q.question_text}
          </p>
          <div className="flex items-center justify-between">
            {!useGrouped && q.section_context && (
              <span className="text-xs text-[#6B7280] bg-[#F5F7FA] px-2 py-0.5 rounded truncate max-w-[120px]">
                {q.section_context}
              </span>
            )}
            {q.assigned_to_name && (
              <span className="w-5 h-5 rounded-full bg-[#2E7D9A] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                {initials(q.assigned_to_name)}
              </span>
            )}
          </div>
        </button>

        {/* Render child questions if expanded */}
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {filtered
              .filter(child => child.parent_id === q.id)
              .sort((a, b) => a.order_index - b.order_index)
              .map(child => renderQuestion(child, true))}
          </div>
        )}
      </div>
    )
  }

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
        ) : useGrouped && parentGroups ? (
          parentGroups.map(({ parent, children }) => (
            <div key={parent.id} className="border-b border-[#E2E8F0]">
              <button
                onClick={() => toggleSection(parent.section_context || 'Uncategorized')}
                className="w-full flex items-center justify-between px-4 py-2 bg-[#F5F7FA] text-left sticky top-0 z-10"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1B3A5C] uppercase tracking-wide truncate mr-2">
                    {parent.section_context || 'Uncategorized'}
                  </span>
                  {children.length > 0 && (
                    <span className="text-[10px] text-[#6B7280] font-medium">
                      ({children.length} sub-questions)
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-[#6B7280] font-medium">
                    {children.length > 0 ? `${1 + children.length}` : '1'}
                  </span>
                  <span className="text-[10px] text-[#6B7280]">
                    {isSectionOpen(parent.section_context || 'Uncategorized') ? '▲' : '▼'}
                  </span>
                </span>
              </button>
              {isSectionOpen(parent.section_context || 'Uncategorized') && (
                <div>
                  {renderQuestion(parent)}
                  {children
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(child => renderQuestion(child, true))}
                </div>
              )}
            </div>
          ))
        ) : (
          filtered.map(q => renderQuestion(q))
        )}
      </div>
    </div>
  )
}
