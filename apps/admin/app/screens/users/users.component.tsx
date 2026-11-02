import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { PageHeading } from '@/app/shared/components/page-heading'
import { UsersWorkspace } from './components/users-workspace'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export async function UsersScreen() {
  const user = await requireAdminSession()

  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Administration"
        title="Administrators"
        description="Manage administrator accounts and access to your store."
      />
      <UsersWorkspace currentUserId={user.id} />
    </div>
  )
}
