import { SectionPreview } from '@/app/shared/components/section-preview'

export function ProductsScreen() {
  return (
    <SectionPreview
      eyebrow="Store"
      title="Products"
      description="Manage your tea collection and product details."
      features={[
        'Edit product details, images, and descriptions',
        'Manage pack sizes in grams and prices in BYN',
        'Draft, publish, and archive products',
        'Search and filter by status',
      ]}
    />
  )
}
