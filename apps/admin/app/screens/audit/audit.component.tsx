import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { PageHeading } from '@/app/shared/components/page-heading'
import { AuditWorkspace } from './components/audit-workspace'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export async function AuditScreen() {
  await requireAdminSession()

  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Administration"
        title="Audit log"
        description="A read-only history of administrative actions, with the latest events first."
      />
      <AuditWorkspace />
    </div>
  )
}
