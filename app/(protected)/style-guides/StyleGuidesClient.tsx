'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import StyleGuideModal, { StyleGuideRow } from '@/components/StyleGuideModal'
import StatusBadge from '@/components/StatusBadge'

const TYPE_LABELS: Record<string, string> = {
  voice: 'Brand Voice',
  format: 'Formatting',
  compliance: 'Compliance',
  firm_context: 'Firm Context',
}

const TYPE_COLORS: Record<string, string> = {
  voice: 'bg-purple-100 text-purple-700',
  format: 'bg-blue-100 text-blue-700',
  compliance: 'bg-red-100 text-red-700',
  firm_context: 'bg-green-100 text-green-700',
}

type FilterType = 'all' | 'voice' | 'format' | 'compliance' | 'firm_context'

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'voice', label: 'Brand Voice' },
  { key: 'format', label: 'Formatting' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'firm_context', label: 'Firm Context' },
]

export default function StyleGuidesClient({ initialGuides }: { initialGuides: StyleGuideRow[] }) {
  const router = useRouter()
  const [guides, setGuides] = useState<StyleGuideRow[]>(initialGuides)
  const [filter, setFilter] = useState<FilterType>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StyleGuideRow | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const filtered = filter === 'all' ? guides : guides.filter((g) => g.type === filter)
  const activeCount = guides.filter((g) => g.is_active && g.approval_status === 'approved').length

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(g: StyleGuideRow) {
    setEditing(g)
    setModalOpen(true)
  }

  function onSaved() {
    setModalOpen(false)
    startTransition(() => router.refresh())
    // Optimistically refetch by triggering a full server revalidation
  }

  async function handleAction(id: string, action: 'approve' | 'toggle_active' | 'reject') {
    const res = await fetch('/api/style-guides', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (!res.ok) return
    // Optimistic update
    setGuides((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g
        if (action === 'approve') return { ...g, approval_status: 'approved' as const }
        if (action === 'reject') return { ...g, approval_status: 'rejected' as const, is_active: false }
        if (action === 'toggle_active') return { ...g, is_active: !g.is_active }
        return g
      })
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#E2E8F0]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#1B3A5C]">Style Guides</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Brand voice, formatting rules, compliance language, and firm context injected into every AI draft.
              {activeCount > 0 && (
                <span className="ml-2 text-green-700 font-medium">{activeCount} active</span>
              )}
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#162f4a] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Guide
          </button>
        </div>

        {/* How it works callout */}
        <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-[#EBF5FA] border border-[#B8D9E8] rounded-lg text-sm text-[#1B3A5C]">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#2E7D9A]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          <span>
            Only guides with status <strong>Approved</strong> and toggle <strong>Active</strong> are injected into drafts.
            Editing a guide resets it to Draft and requires re-approval before it takes effect.
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-[#E2E8F0] px-6">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === t.key
                ? 'border-[#2E7D9A] text-[#2E7D9A]'
                : 'border-transparent text-[#6B7280] hover:text-[#1A1A2E]'
            }`}
          >
            {t.label}
            {t.key !== 'all' && (
              <span className="ml-1.5 text-xs text-[#9CA3AF]">
                {guides.filter((g) => g.type === t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Guide list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[#6B7280] text-sm mb-3">No style guides yet.</p>
            <button
              onClick={openAdd}
              className="text-sm text-[#2E7D9A] hover:underline"
            >
              Add your first guide
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {filtered.map((g) => {
              const isExpanded = expanded === g.id
              const canActivate = g.approval_status === 'approved'
              return (
                <div key={g.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[g.type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {TYPE_LABELS[g.type] ?? g.type}
                        </span>
                        <StatusBadge status={g.approval_status} />
                        {g.is_active && g.approval_status === 'approved' && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            Live
                          </span>
                        )}
                        <span className="text-xs text-[#9CA3AF]">v{g.version}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[#1A1A2E]">{g.name}</h3>
                      {g.description && (
                        <p className="text-xs text-[#6B7280] mt-0.5">{g.description}</p>
                      )}
                      {isExpanded && (
                        <pre className="mt-3 text-xs text-[#1A1A2E] bg-[#F5F7FA] border border-[#E2E8F0] rounded p-3 whitespace-pre-wrap font-mono leading-relaxed">
                          {g.content}
                        </pre>
                      )}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : g.id)}
                        className="text-xs text-[#2E7D9A] hover:underline mt-1.5"
                      >
                        {isExpanded ? 'Hide content' : 'View content'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Active toggle */}
                      <button
                        onClick={() => handleAction(g.id, 'toggle_active')}
                        disabled={!canActivate}
                        title={!canActivate ? 'Must be approved first' : g.is_active ? 'Deactivate' : 'Activate'}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          g.is_active && canActivate
                            ? 'bg-green-500'
                            : 'bg-[#D1D5DB]'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            g.is_active && canActivate ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>

                      {/* Approve */}
                      {g.approval_status !== 'approved' && (
                        <button
                          onClick={() => handleAction(g.id, 'approve')}
                          className="text-xs px-2.5 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                        >
                          Approve
                        </button>
                      )}

                      {/* Reject */}
                      {g.approval_status === 'approved' && (
                        <button
                          onClick={() => handleAction(g.id, 'reject')}
                          className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Revoke
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => openEdit(g)}
                        className="text-xs px-2.5 py-1 rounded border border-[#E2E8F0] text-[#1A1A2E] hover:bg-[#F5F7FA] transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <StyleGuideModal
          existing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
