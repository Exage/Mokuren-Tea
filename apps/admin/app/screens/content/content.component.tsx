import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { PageHeading } from '@/app/shared/components/page-heading'
import { ContentWorkspace } from './components/content-workspace'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export async function ContentScreen() {
  await requireAdminSession()
  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Website"
        title="Website content"
        description="Shape your store’s story. Edit, preview, and publish each section at your own pace."
      />
      <ContentWorkspace />
    </div>
  )
}
