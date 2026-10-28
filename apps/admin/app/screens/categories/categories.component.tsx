import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { DictionaryEditor } from '@/app/shared/components/dictionary-editor'
import { PageHeading } from '@/app/shared/components/page-heading'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export async function CategoriesScreen() {
  await requireAdminSession()
  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Catalog"
        title="Categories"
        description="Organize teas, change display order, and move products between categories."
      />
      <DictionaryEditor kind="categories" />
    </div>
  )
}
