'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FileDropzone from '@/components/FileDropzone'

type Stage = 'form' | 'parsing' | 'review'

interface ParsedQuestion {
  question_text: string
  section_context: string
}

const PROJECT_TYPES = ['RFP', 'DDQ', 'Security Questionnaire', 'Consultant Database', 'Other']

export default function NewRfpPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('form')
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [file, setFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [projectName, setProjectName] = useState('')
  const [clientName, setClientName] = useState('')
  const [projectType, setProjectType] = useState('RFP')
  const [dueDate, setDueDate] = useState('')

  // Review state
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())
  const [projectId, setProjectId] = useState<string | null>(null)

  async function handleParse(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!projectName.trim()) {
      setError('Project name is required.')
      return
    }

    if (!file && !pastedText.trim()) {
      setError('Upload a file or paste questions.')
      return
    }

    setStage('parsing')

    const fd = new FormData()
    if (file) fd.append('file', file)
    else fd.append('text', pastedText)
    fd.append('name', projectName.trim())
    fd.append('client_name', clientName.trim())
    fd.append('project_type', projectType)
    if (dueDate) fd.append('due_date', dueDate)

    try {
      const res = await fetch('/api/parse-rfp', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Parse failed')
        setStage('form')
        return
      }

      setParsedQuestions(json.questions ?? [])
      setProjectId(json.project_id)
      setSelectedIndexes(new Set((json.questions ?? []).map((_: unknown, i: number) => i)))
      setStage('review')
    } catch (err) {
      setError('Network error. Please try again.')
      console.error(err)
      setStage('form')
    }
  }

  function toggleQuestion(idx: number) {
    setSelectedIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function toggleAll() {
    if (selectedIndexes.size === parsedQuestions.length) {
      setSelectedIndexes(new Set())
    } else {
      setSelectedIndexes(new Set(parsedQuestions.map((_, i) => i)))
    }
  }

  function handleGoToProject() {
    if (projectId) {
      router.push(`/rfps/${projectId}`)
    }
  }

  // ── Parsing stage ──
  if (stage === 'parsing') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#2E7D9A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#1B3A5C] font-medium">Extracting questions from document…</p>
          <p className="text-xs text-[#6B7280] mt-1">This may take a few seconds.</p>
        </div>
      </div>
    )
  }

  // ── Review stage ──
  if (stage === 'review') {
    const sections = Array.from(new Set(parsedQuestions.map((q) => q.section_context).filter(Boolean)))

    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-[#1B3A5C]">Review Parsed Questions</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {parsedQuestions.length} questions extracted · {selectedIndexes.size} selected
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStage('form')}
              className="text-sm text-[#6B7280] hover:text-[#1B3A5C] px-3 py-1.5 border border-[#E2E8F0] rounded transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleGoToProject}
              disabled={!projectId}
              className="bg-[#1B3A5C] hover:bg-[#2E7D9A] text-white text-sm font-medium px-5 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              Go to Project →
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0] bg-[#F5F7FA]">
            <input
              type="checkbox"
              checked={selectedIndexes.size === parsedQuestions.length}
              onChange={toggleAll}
              className="rounded"
            />
            <span className="text-xs font-medium text-[#1B3A5C]">
              Select / deselect all
            </span>
            {sections.length > 0 && (
              <span className="ml-auto text-xs text-[#6B7280]">
                {sections.length} section{sections.length !== 1 ? 's' : ''} detected
              </span>
            )}
          </div>

          <div className="divide-y divide-[#F0F2F5] max-h-[60vh] overflow-y-auto">
            {parsedQuestions.map((q, idx) => (
              <label
                key={idx}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[#F8F9FB] transition-colors ${
                  !selectedIndexes.has(idx) ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIndexes.has(idx)}
                  onChange={() => toggleQuestion(idx)}
                  className="mt-0.5 rounded flex-shrink-0"
                />
                <div className="min-w-0">
                  {q.section_context && (
                    <span className="text-xs font-medium text-[#2E7D9A] block mb-0.5">
                      {q.section_context}
                    </span>
                  )}
                  <p className="text-sm text-[#1A1A2E] leading-snug">{q.question_text}</p>
                </div>
                <span className="text-xs text-[#6B7280] ml-auto flex-shrink-0 mt-0.5">
                  #{idx + 1}
                </span>
              </label>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#6B7280] mt-3">
          The project has been created. Questions are already saved — deselecting here only affects your view.
          Use the project page to delete individual questions.
        </p>
      </div>
    )
  }

  // ── Form stage ──
  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-[#1B3A5C] mb-1">New RFP Project</h1>
      <p className="text-xs text-[#6B7280] mb-6">Upload a questionnaire to extract and match questions.</p>

      <form onSubmit={handleParse} className="space-y-6">
        {/* Project metadata */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#1B3A5C]">Project Details</h2>

          <div>
            <label className="block text-xs font-medium text-[#1A1A2E] mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Acme Pension Fund RFP Q2 2025"
              className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1A1A2E] mb-1">Client Name</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Pension Fund"
                className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1A1A2E] mb-1">Project Type</label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
              >
                {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1A1A2E] mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A]"
            />
          </div>
        </div>

        {/* Document upload */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#1B3A5C]">Questionnaire</h2>

          <FileDropzone file={file} onChange={setFile} />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-xs text-[#6B7280]">OR</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1A1A2E] mb-1">
              Paste questions directly
            </label>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your RFP questions here, one per line or numbered…"
              className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D9A] resize-y"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-[#1B3A5C] hover:bg-[#2E7D9A] text-white text-sm font-medium px-6 py-2 rounded transition-colors"
          >
            Parse Questions →
          </button>
        </div>
      </form>
    </div>
  )
}
