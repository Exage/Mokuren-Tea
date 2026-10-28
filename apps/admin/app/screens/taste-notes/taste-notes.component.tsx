import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { DictionaryEditor } from '@/app/shared/components/dictionary-editor'
import { PageHeading } from '@/app/shared/components/page-heading'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export async function TasteNotesScreen() {
  await requireAdminSession()
  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Catalog"
        title="Taste notes"
        description="Create and organize the tasting notes used across your collection."
      />
      <DictionaryEditor kind="taste-notes" />
    </div>
  )
}
