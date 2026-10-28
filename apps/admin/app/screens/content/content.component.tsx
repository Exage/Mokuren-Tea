import { requireAdminSession } from '@/app/shared/api/requests/admin-session'
import { SectionPreview } from '@/app/shared/components/section-preview'

export async function ContentScreen() {
  await requireAdminSession()

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
