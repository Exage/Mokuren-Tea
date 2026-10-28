import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { PageHeading } from '@/app/shared/components/page-heading'
import { MediaWorkspace } from './components/media-workspace'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export async function MediaScreen() {
  await requireAdminSession()
  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Store"
        title="Media"
        description="Upload images and manage the media used throughout your store."
      />
      <MediaWorkspace />
    </div>
  )
}
