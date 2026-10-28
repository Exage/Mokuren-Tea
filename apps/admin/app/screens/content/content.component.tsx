import { SectionPreview } from '@/app/shared/components/section-preview'

export function ContentScreen() {
  return (
    <SectionPreview
      eyebrow="Catalog and website"
      title="Website content"
      description="Manage the store story, recommendations, and page content."
      features={[
        'Edit predefined content blocks',
        'Save drafts and preview changes',
        'Publish content and browse revisions',
        'Restore a revision as a draft',
      ]}
    />
  )
}
