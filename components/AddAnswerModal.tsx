'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface AddAnswerModalProps {
  categories: string[]
  onClose: () => void
}

export default function AddAnswerModal({ categories, onClose }: AddAnswerModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    question_text: '',
    answer_text: '',
    topic_category: '',
    client_type: '',
    review_interval_days: 180,
    source_document: '',
  })

  function set(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const expiresAt = new Date(
      Date.now() + form.review_interval_days * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data: inserted, error: insertError } = await supabase
      .from('answers')
      .insert({
        question_text: form.question_text,
        answer_text: form.answer_text,
        topic_category: form.topic_category || null,
        client_type: form.client_type || null,
        source_document: form.source_document || null,
        review_interval_days: form.review_interval_days,
        owner_id: session.user.id,
        approval_status: 'draft',
        expires_at: expiresAt,
        version: 1,
      })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Audit log
    await supabase.from('approval_events').insert({
      entity_type: 'answer',
      entity_id: inserted.id,
      action: 'create',
      actor_id: session.user.id,
    })

    setLoading(false)
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg border border-[#E2E8F0] w-full max-w-2xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-semibold text-[#1B3A5C]">Add Answer to Library</h2>
          <button
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#1B3A5C] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#1A1A2E] mb-1">
              Question <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={form.question_text}
              onChange={(e) => set('question_text', e.target.value)}
              placeholder="The RFP question this answer addresses…"
              className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1A1A2E] mb-1">
              Answer <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={6}
              value={form.answer_text}
              onChange={(e) => set('answer_text', e.target.value)}
              placeholder="Approved firm response…"
              className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A] resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1A1A2E] mb-1">Topic Category</label>
              <input
                list="category-list"
                value={form.topic_category}
                onChange={(e) => set('topic_category', e.target.value)}
                placeholder="e.g. Investment Process"
                className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
              />
              <datalist id="category-list">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1A1A2E] mb-1">Client Type</label>
              <input
                value={form.client_type}
                onChange={(e) => set('client_type', e.target.value)}
                placeholder="e.g. Pension Fund"
                className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1A1A2E] mb-1">
                Review Interval (days)
              </label>
              <input
                type="number"
                min={7}
                max={730}
                value={form.review_interval_days}
                onChange={(e) => set('review_interval_days', Number(e.target.value))}
                className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1A1A2E] mb-1">Source Document</label>
              <input
                value={form.source_document}
                onChange={(e) => set('source_document', e.target.value)}
                placeholder="Optional filename or reference"
                className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-[#6B7280] hover:text-[#1B3A5C] px-4 py-2 rounded border border-[#E2E8F0] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#1B3A5C] hover:bg-[#2E7D9A] text-white text-sm font-medium px-5 py-2 rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Add to Library'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
