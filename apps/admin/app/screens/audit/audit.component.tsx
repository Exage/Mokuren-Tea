import { SectionPreview } from '@/app/shared/components/section-preview'

export function AuditScreen() {
  return (
    <SectionPreview
      eyebrow="Administration"
      title="Audit log"
      description="A clear history of changes to your store."
      features={[
        'View administrative actions',
        'Filter by administrator, action, and resource',
        'Browse a read-only, paginated history',
      ]}
    />
  )
}
