import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase-server'
import AnswerTable from '@/components/AnswerTable'
import type { AnswerRow } from '@/types/database'

export const dynamic = 'force-dynamic'

type AnswerWithOwner = AnswerRow & {
  users: { full_name: string | null } | null
}

export default async function LibraryPage() {
  const supabase = createServerClient()

  const { data: answers } = await supabase
    .from('answers')
    .select('*, users!owner_id(full_name)')
    .order('updated_at', { ascending: false })

  const typedAnswers = (answers ?? []) as AnswerWithOwner[]

  // Distinct categories
  const categories = Array.from(
    new Set(typedAnswers.map((a) => a.topic_category).filter((c): c is string => !!c))
  ).sort()

  // Distinct client types
  const clientTypes = Array.from(
    new Set(typedAnswers.map((a) => a.client_type).filter((c): c is string => !!c))
  ).sort()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-[#1B3A5C]">Answer Library</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {typedAnswers.length} answers · approved content only is used for AI drafting
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="text-sm text-[#6B7280]">Loading answers…</div>}>
        <AnswerTable
          answers={typedAnswers}
          categories={categories}
          clientTypes={clientTypes}
        />
      </Suspense>
    </div>
  )
}
