import { SectionPreview } from '@/app/shared/components/section-preview'

export function CategoriesScreen() {
  return (
    <SectionPreview
      eyebrow="Catalog and website"
      title="Categories"
      description="Organize the catalog by tea category."
      features={[
        'Create and edit categories',
        'Manage names, slugs, and display order',
        'Move products before deleting a category',
      ]}
    />
  )
}
