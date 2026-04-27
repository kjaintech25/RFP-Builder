import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createBrowserClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
