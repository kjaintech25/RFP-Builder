'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export type StyleGuideRow = {
  id: string
  name: string
  type: 'voice' | 'format' | 'compliance' | 'firm_context'
  description: string | null
  content: string
  is_active: boolean
  version: number
  approval_status: 'draft' | 'approved' | 'in_review' | 'stale' | 'rejected'
  created_at: string
  updated_at: string
}

const TYPE_OPTIONS = [
  { value: 'voice', label: 'Brand Voice', description: 'Tone, writing style, persona' },
  { value: 'format', label: 'Formatting Rules', description: 'Structure, length, bullet usage' },
  { value: 'compliance', label: 'Compliance', description: 'Required language, disclaimers' },
  { value: 'firm_context', label: 'Firm Context', description: 'AUM, history, key differentiators' },
]

const PLACEHOLDERS: Record<string, string> = {
  voice: `Example:
- Write in first person plural ("we", "our firm", "our team"). Never use passive voice.
- Lead with the conclusion, then provide supporting evidence.
- Use confident, precise language. Avoid hedging words like "may", "could", "might" unless factually required.
- Keep sentences under 25 words where possible. Prefer short paragraphs (2–3 sentences).`,
  format: `Example:
- Open with a 1–2 sentence executive summary answering the question directly.
- Use bullet points only for lists of 3 or more items.
- Do not use headers within a single answer unless the question has multiple parts.
- Spell out numbers under 10. Use numerals for 10 and above. Always write "$X billion" not "$XB".`,
  compliance: `Example:
- Any answer touching fiduciary duty must include: "As a registered investment adviser, [Firm] acts as a fiduciary in all client relationships."
- Do not quote specific return figures without the following disclosure: "Past performance is not indicative of future results."
- Never state AUM as a specific figure — use "approximately $X billion as of [quarter]" with source citation.`,
  firm_context: `Example:
- The firm was founded in 1998 and is headquartered in New York, NY.
- We manage approximately $42 billion in assets across public and private markets.
- Our client base consists exclusively of institutional investors: endowments, foundations, and public pension funds.
- We operate as a fully independent firm with no affiliated broker-dealer.`,
}

export default function StyleGuideModal({
  existing,
  onClose,
  onSaved,
}: {
  existing?: StyleGuideRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!existing
  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<string>(existing?.type ?? 'voice')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [content, setContent] = useState(existing?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !content.trim()) {
      setError('Name and content are required.')
      return
    }
    setSaving(true)
    setError(null)

    if (isEditing) {
      const { error: err } = await supabase
        .from('style_guides')
        .update({ name: name.trim(), type, description: description.trim() || null, content: content.trim() })
        .eq('id', existing!.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated.'); setSaving(false); return }
      const { error: err } = await supabase
        .from('style_guides')
        .insert({
          name: name.trim(),
          type,
          description: description.trim() || null,
          content: content.trim(),
          approval_status: 'draft',
          is_active: false,
          created_by: user.id,
        })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-semibold text-[#1B3A5C]">
            {isEditing ? 'Edit Style Guide' : 'Add Style Guide'}
          </h2>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#1A1A2E]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Core Brand Voice, ERISA Compliance Language"
                className="w-full text-sm border border-[#E2E8F0] rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2E7D9A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`text-left px-3 py-2.5 rounded border text-sm transition-colors ${
                      type === opt.value
                        ? 'border-[#2E7D9A] bg-[#EBF5FA] text-[#1B3A5C]'
                        : 'border-[#E2E8F0] text-[#1A1A2E] hover:bg-[#F5F7FA]'
                    }`}
                  >
                    <span className="font-medium block">{opt.label}</span>
                    <span className="text-xs text-[#6B7280]">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">
                Description <span className="font-normal text-[#6B7280]">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of what this guide covers"
                className="w-full text-sm border border-[#E2E8F0] rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#2E7D9A]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#1A1A2E]">Content</label>
                {isEditing && (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Editing will reset approval status to Draft
                  </span>
                )}
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder={PLACEHOLDERS[type] ?? ''}
                className="w-full text-sm border border-[#E2E8F0] rounded px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#2E7D9A] font-mono leading-relaxed"
              />
              <p className="text-xs text-[#6B7280] mt-1">
                Write rules as plain instructions. The AI reads this verbatim before drafting.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 rounded border border-[#E2E8F0] text-[#1A1A2E] hover:bg-[#F5F7FA] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-4 py-2 rounded bg-[#1B3A5C] text-white hover:bg-[#162f4a] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Guide'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
