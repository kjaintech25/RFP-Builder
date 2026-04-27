'use client'

import { useState } from 'react'
import StatusBadge from '@/components/StatusBadge'
import AddAnswerModal from '@/components/AddAnswerModal'
import type { AnswerRow, ApprovalStatus } from '@/types/database'

type AnswerWithOwner = AnswerRow & {
  users: { full_name: string | null } | null
}

interface AnswerTableProps {
  answers: AnswerWithOwner[]
  categories: string[]
  clientTypes: string[]
}

const PAGE_SIZE = 50

function trunc(str: string | null | undefined, max: number): string {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AnswerTable({ answers, categories, clientTypes }: AnswerTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [clientTypeFilter, setClientTypeFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [showModal, setShowModal] = useState(false)

  const filtered = answers.filter((a) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      a.question_text.toLowerCase().includes(q) ||
      a.answer_text.toLowerCase().includes(q) ||
      (a.topic_category ?? '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || a.approval_status === statusFilter
    const matchCat = categoryFilter === 'all' || a.topic_category === categoryFilter
    const matchClient = clientTypeFilter === 'all' || a.client_type === clientTypeFilter
    return matchSearch && matchStatus && matchCat && matchClient
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function resetPage() {
    setPage(0)
  }

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          placeholder="Search questions or answers…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage() }}
          className="border border-[#E2E8F0] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A] w-64"
        />

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as ApprovalStatus | 'all'); resetPage() }}
          className="border border-[#E2E8F0] rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="in_review">In Review</option>
          <option value="draft">Draft</option>
          <option value="stale">Stale</option>
          <option value="rejected">Rejected</option>
        </select>

        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); resetPage() }}
            className="border border-[#E2E8F0] rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
          >
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {clientTypes.length > 0 && (
          <select
            value={clientTypeFilter}
            onChange={(e) => { setClientTypeFilter(e.target.value); resetPage() }}
            className="border border-[#E2E8F0] rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
          >
            <option value="all">All client types</option>
            {clientTypes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <div className="ml-auto">
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#1B3A5C] hover:bg-[#2E7D9A] text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
          >
            + Add Answer
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F5F7FA] border-b border-[#E2E8F0]">
                <th className="text-left px-3 py-2.5 font-semibold text-[#1B3A5C] w-6">#</th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#1B3A5C]">Question</th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#1B3A5C]">Answer</th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#1B3A5C] w-32">Category</th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#1B3A5C] w-28">Client Type</th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#1B3A5C] w-24">Status</th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#1B3A5C] w-28">Owner</th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#1B3A5C] w-28">Last Reviewed</th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#1B3A5C] w-24">Expires</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[#6B7280]">
                    No answers found.
                  </td>
                </tr>
              ) : (
                paginated.map((answer, idx) => (
                  <tr
                    key={answer.id}
                    className={`border-b border-[#F0F2F5] hover:bg-[#F8F9FB] ${
                      answer.approval_status === 'stale' ? 'bg-amber-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-[#6B7280]">{safePage * PAGE_SIZE + idx + 1}</td>
                    <td className="px-3 py-2 max-w-[240px]">
                      <span title={answer.question_text} className="leading-snug">
                        {trunc(answer.question_text, 80)}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[280px] text-[#6B7280]">
                      <span title={answer.answer_text}>
                        {trunc(answer.answer_text, 100)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#6B7280]">{trunc(answer.topic_category, 28)}</td>
                    <td className="px-3 py-2 text-[#6B7280]">{trunc(answer.client_type, 22)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={answer.approval_status} />
                    </td>
                    <td className="px-3 py-2 text-[#6B7280]">
                      {answer.users?.full_name ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-[#6B7280]">{formatDate(answer.last_reviewed_at)}</td>
                    <td className={`px-3 py-2 ${answer.approval_status === 'stale' ? 'text-amber-700 font-medium' : 'text-[#6B7280]'}`}>
                      {formatDate(answer.expires_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E2E8F0] bg-[#F5F7FA]">
            <span className="text-xs text-[#6B7280]">
              {filtered.length} results — Page {safePage + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="text-xs px-3 py-1 border border-[#E2E8F0] rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="text-xs px-3 py-1 border border-[#E2E8F0] rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddAnswerModal
          categories={categories}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
