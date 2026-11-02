import { Suspense } from 'react'
import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { ReservationsWorkspace } from './components/reservations-workspace'

export async function ReservationsScreen() {
  await requireAdminSession()
  return (
    <Suspense fallback={<p role="status">Loading reservations…</p>}>
      <ReservationsWorkspace />
    </Suspense>
  )
}
