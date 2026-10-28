import { SectionPreview } from '@/app/shared/components/section-preview'

export function SettingsScreen() {
  return (
    <SectionPreview
      eyebrow="Administration"
      title="Settings"
      description="Keep your store information up to date."
      features={[
        'Edit the store name and tagline',
        'Update contacts, address, and opening hours',
        'Manage general store settings',
      ]}
    />
  )
}
