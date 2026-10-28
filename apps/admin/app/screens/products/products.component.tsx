import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { PageHeading } from '@/app/shared/components/page-heading'
import { ProductWorkspace } from './components/product-workspace'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'

export async function ProductsScreen() {
  await requireAdminSession()
  return (
    <div className={styles.stack}>
      <PageHeading
        eyebrow="Store"
        title="Products"
        description="Manage your collection, product images, pack sizes, and publication."
      />
      <ProductWorkspace />
    </div>
  )
}
