'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import type { ProjectStatus } from '@/types/database'

interface ProjectCardProps {
  id: string
  name: string
  client_name: string | null
  project_type: string | null
  due_date: string | null
  status: ProjectStatus
  total_questions: number
  answered_questions: number
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const due = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function dueDateClass(days: number | null): string {
  if (days === null) return 'text-[#6B7280]'
  if (days < 0) return 'text-red-600 font-semibold'
  if (days <= 3) return 'text-red-600 font-semibold'
  if (days <= 7) return 'text-amber-600 font-semibold'
  return 'text-green-700'
}

function dueDateLabel(days: number | null): string {
  if (days === null) return 'No due date'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `${days}d remaining`
}

export default function ProjectCard({
  id,
  name,
  client_name,
  project_type,
  due_date,
  status,
  total_questions,
  answered_questions,
}: ProjectCardProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const days = daysUntil(due_date)
  const pct = total_questions > 0 ? Math.round((answered_questions / total_questions) * 100) : 0

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/rfps/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="relative group">
      <Link
        href={`/rfps/${id}`}
        className={`block bg-white border border-[#E2E8F0] rounded-lg p-4 hover:border-[#2E7D9A] hover:shadow-sm transition-all ${deleting ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-[#1B3A5C] text-sm leading-tight flex-1 min-w-0 truncate">
            {name}
          </h3>
          {project_type && (
            <span className="text-xs bg-[#EEF2F7] text-[#1B3A5C] px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
              {project_type}
            </span>
          )}
        </div>

        {client_name && (
          <p className="text-xs text-[#6B7280] mb-3 truncate">{client_name}</p>
        )}

        <div className="flex items-center justify-between mb-3">
          <StatusBadge status={status} />
          <span className={`text-xs ${dueDateClass(days)}`}>{dueDateLabel(days)}</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[#6B7280]">
            <span>{answered_questions} / {total_questions} answered</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-[#E2E8F0] rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-[#2E7D9A] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </Link>

      {/* Kebab menu — shown on hover */}
      <div
        ref={menuRef}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.preventDefault()}
      >
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((o) => !o) }}
          className="w-6 h-6 flex items-center justify-center rounded text-[#6B7280] hover:bg-[#E2E8F0] hover:text-[#1B3A5C] text-base leading-none"
          title="More actions"
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-7 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 w-36 z-10">
            <button
              onClick={handleDelete}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Delete project
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
