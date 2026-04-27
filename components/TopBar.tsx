'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  compliance: 'Compliance',
  sme: 'SME',
  analyst: 'Analyst',
  read_only: 'Read Only',
}

interface TopBarProps {
  user: {
    full_name: string | null
    email: string
    role: UserRole
  } | null
}

export default function TopBar({ user }: TopBarProps) {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="h-12 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-6 flex-shrink-0">
      <div />

      <div className="flex items-center gap-3">
        {user && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#EEF2F7] text-[#1B3A5C]">
            {roleLabels[user.role] ?? user.role}
          </span>
        )}

        <div className="w-7 h-7 rounded-full bg-[#2E7D9A] flex items-center justify-center text-white text-xs font-semibold">
          {initials}
        </div>

        <button
          onClick={handleLogout}
          className="text-xs text-[#6B7280] hover:text-[#1B3A5C] transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
