import { SectionPreview } from '@/app/shared/components/section-preview'

export function TasteNotesScreen() {
  return (
    <SectionPreview
      eyebrow="Catalog and website"
      title="Taste notes"
      description="Manage the flavors and aromas used across your tea collection."
      features={[
        'Create and edit taste notes',
        'Check which products use a taste note',
        'Review linked products before deletion',
      ]}
    />
  )
}
