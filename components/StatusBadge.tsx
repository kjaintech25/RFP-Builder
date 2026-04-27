import type { ApprovalStatus, ProjectStatus, QuestionStatus } from '@/types/database'

type BadgeStatus = ApprovalStatus | ProjectStatus | QuestionStatus

const statusConfig: Record<BadgeStatus, { label: string; className: string }> = {
  approved:   { label: 'Approved',   className: 'bg-green-100 text-green-800' },
  in_review:  { label: 'In Review',  className: 'bg-yellow-100 text-yellow-800' },
  stale:      { label: 'Stale',      className: 'bg-amber-100 text-amber-800' },
  rejected:   { label: 'Rejected',   className: 'bg-red-100 text-red-800' },
  draft:      { label: 'Draft',      className: 'bg-gray-100 text-gray-600' },
  active:     { label: 'Active',     className: 'bg-blue-100 text-blue-800' },
  unanswered: { label: 'Unanswered', className: 'bg-slate-100 text-slate-600' },
  drafted:    { label: 'Drafted',    className: 'bg-indigo-100 text-indigo-800' },
  submitted:  { label: 'Submitted',  className: 'bg-teal-100 text-teal-800' },
  archived:   { label: 'Archived',   className: 'bg-gray-100 text-gray-400' },
}

interface StatusBadgeProps {
  status: BadgeStatus
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }

  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${config.className} ${className}`}
    >
      {config.label}
    </span>
  )
}
