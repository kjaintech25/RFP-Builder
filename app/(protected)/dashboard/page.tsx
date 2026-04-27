import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import ProjectCard from '@/components/ProjectCard'
import type { ProjectStatus, RfpProjectRow, RfpQuestionRow } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerClient()

  // Fetch active projects
  const { data: projectsData } = await supabase
    .from('rfp_projects')
    .select('*')
    .eq('status', 'active')
    .order('due_date', { ascending: true })

  const projects = (projectsData ?? []) as RfpProjectRow[]

  // Fetch question counts per project
  const projectIds = projects.map((p) => p.id)
  const totalMap: Record<string, number> = {}
  const answeredMap: Record<string, number> = {}
  const ANSWERED_STATUSES = new Set(['drafted', 'in_review', 'approved'])

  if (projectIds.length > 0) {
    const { data: rawCounts } = await supabase
      .from('rfp_questions')
      .select('project_id, status')
      .in('project_id', projectIds)

    for (const row of (rawCounts ?? []) as Pick<RfpQuestionRow, 'project_id' | 'status'>[]) {
      totalMap[row.project_id] = (totalMap[row.project_id] ?? 0) + 1
      if (ANSWERED_STATUSES.has(row.status)) {
        answeredMap[row.project_id] = (answeredMap[row.project_id] ?? 0) + 1
      }
    }
  }

  // Summary stats
  const { count: activeCount } = await supabase
    .from('rfp_projects')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const sevenDaysOut = new Date()
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)

  const { count: dueSoonCount } = await supabase
    .from('rfp_questions')
    .select('*', { count: 'exact', head: true })
    .lte('due_date', sevenDaysOut.toISOString().split('T')[0])
    .neq('status', 'approved')

  const { count: staleCount } = await supabase
    .from('answers')
    .select('*', { count: 'exact', head: true })
    .eq('approval_status', 'stale')

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Active RFPs" value={activeCount ?? 0} />
        <StatCard label="Questions Due This Week" value={dueSoonCount ?? 0} color="amber" />
        <StatCard label="Stale Answers" value={staleCount ?? 0} color="red" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-[#1B3A5C]">Active Projects</h1>
        <Link
          href="/rfps/new"
          className="bg-[#2E7D9A] hover:bg-[#1B3A5C] text-white text-sm font-medium px-4 py-2 rounded transition-colors"
        >
          + New RFP
        </Link>
      </div>

      {/* Project grid */}
      {projects && projects.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              client_name={project.client_name}
              project_type={project.project_type}
              due_date={project.due_date}
              status={project.status as ProjectStatus}
              total_questions={totalMap[project.id] ?? 0}
              answered_questions={answeredMap[project.id] ?? 0}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-[#E2E8F0] rounded-lg bg-white">
          <svg
            className="w-10 h-10 text-[#6B7280] mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-[#6B7280] mb-4">No active RFP projects yet.</p>
          <Link
            href="/rfps/new"
            className="bg-[#1B3A5C] hover:bg-[#2E7D9A] text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            Upload your first RFP
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'navy',
}: {
  label: string
  value: number
  color?: 'navy' | 'amber' | 'red'
}) {
  const valueClass =
    color === 'amber'
      ? 'text-amber-600'
      : color === 'red'
      ? 'text-red-600'
      : 'text-[#1B3A5C]'

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg px-5 py-4">
      <p className="text-xs text-[#6B7280] mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}
