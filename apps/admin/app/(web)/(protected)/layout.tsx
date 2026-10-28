import type { ReactNode } from 'react'
import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { AdminShell } from '@/app/shared/components/admin-shell'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminSession()
  return <AdminShell user={user}>{children}</AdminShell>
}
