import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { PageHeading } from '@/app/shared/components/page-heading'
import { InventoryWorkspace } from './components/inventory-workspace'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export async function InventoryScreen() {
  await requireAdminSession()
  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Store"
        title="Inventory"
        description="Track stock in grams, record movements, and review inventory history."
      />
      <InventoryWorkspace />
    </div>
  )
}
