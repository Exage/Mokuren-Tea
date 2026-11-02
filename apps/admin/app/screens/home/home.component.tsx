import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { PageHeading } from '@/app/shared/components/page-heading'
import { OverviewWorkspace } from './components/overview-workspace'

export async function HomeScreen() {
  await requireAdminSession()

  return (
    <div>
      <PageHeading
        eyebrow="Store / Overview"
        title="Overview"
        description="Reservations, products, and inventory at a glance."
      />
      <OverviewWorkspace />
    </div>
  )
}
