import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { PageHeading } from '@/app/shared/components/page-heading'
import { SettingsWorkspace } from './components/settings-workspace'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export async function SettingsScreen() {
  await requireAdminSession()

  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Administration"
        title="Settings"
        description="Keep your store information and contact details up to date."
      />
      <SettingsWorkspace />
    </div>
  )
}
