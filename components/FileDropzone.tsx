'use client'

import { useRef, useState } from 'react'

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const ACCEPTED_EXTENSIONS = ['.docx', '.pdf', '.xlsx']

function isValidFile(file: File): boolean {
  if (ACCEPTED_TYPES.has(file.type)) return true
  const lower = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

interface FileDropzoneProps {
  file: File | null
  onChange: (file: File | null) => void
}

export default function FileDropzone({ file, onChange }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [typeError, setTypeError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return
    if (!isValidFile(dropped)) {
      setTypeError(true)
      return
    }
    setTypeError(false)
    onChange(dropped)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (!isValidFile(selected)) {
      setTypeError(true)
      return
    }
    setTypeError(false)
    onChange(selected)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-[#2E7D9A] bg-[#EEF6FB]'
            : file
            ? 'border-[#2E7D9A] bg-[#F5FBFE]'
            : 'border-[#E2E8F0] hover:border-[#2E7D9A] bg-[#F5F7FA]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.pdf,.xlsx"
          className="hidden"
          onChange={handleChange}
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <svg className="w-6 h-6 text-[#2E7D9A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-left">
              <p className="text-sm font-medium text-[#1B3A5C]">{file.name}</p>
              <p className="text-xs text-[#6B7280]">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
            </div>
          </div>
        ) : (
          <>
            <svg className="w-10 h-10 text-[#6B7280] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-[#1B3A5C] mb-1">
              {isDragging ? 'Drop to upload' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-[#6B7280]">Accepts .docx, .pdf, .xlsx</p>
          </>
        )}
      </div>

      {typeError && (
        <p className="text-xs text-red-600 mt-1">
          Unsupported file type. Please upload a .docx, .pdf, or .xlsx file.
        </p>
      )}
    </div>
  )
}
