import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import StyleGuidesClient from './StyleGuidesClient'

export const dynamic = 'force-dynamic'

export default async function StyleGuidesPage() {
  const cookieStore = cookies()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: guides } = await supabase
    .from('style_guides')
    .select('id, name, type, description, content, is_active, version, approval_status, created_at, updated_at')
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  return <StyleGuidesClient initialGuides={guides ?? []} />
}
