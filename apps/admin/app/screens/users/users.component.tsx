import { SectionPreview } from '@/app/shared/components/section-preview'

export function UsersScreen() {
  return (
    <SectionPreview
      eyebrow="Administration"
      title="Administrators"
      description="Manage administrator access to the store."
      features={[
        'Create and edit administrator accounts',
        'Enable or disable access',
        'Reset passwords and revoke sessions',
      ]}
    />
  )
}
