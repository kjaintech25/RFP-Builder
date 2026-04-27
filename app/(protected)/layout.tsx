import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import type { UserRole, UserRow } from '@/types/database'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: userRowRaw } = await supabase
    .from('users')
    .select('full_name, role, email')
    .eq('id', session.user.id)
    .single()

  const userRow = userRowRaw as Pick<UserRow, 'full_name' | 'role' | 'email'> | null

  const user = userRow
    ? {
        full_name: userRow.full_name,
        email: userRow.email,
        role: userRow.role as UserRole,
      }
    : {
        full_name: null,
        email: session.user.email ?? '',
        role: 'analyst' as UserRole,
      }

  return (
    <div className="flex h-screen bg-[#F5F7FA]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
