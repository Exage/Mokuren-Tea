import { SectionPreview } from '@/app/shared/components/section-preview'

export function MediaScreen() {
  return (
    <SectionPreview
      eyebrow="Catalog and website"
      title="Media library"
      description="A shared image library for the catalog and website."
      features={[
        'Upload images',
        'Edit image names and alt text',
        'Check where images are used',
        'Delete unused images',
      ]}
    />
  )
}
