import { SectionPreview } from '@/app/shared/components/section-preview'

export function InventoryScreen() {
  return (
    <SectionPreview
      eyebrow="Store"
      title="Inventory"
      description="Track physical, reserved, and available stock in grams."
      features={[
        'View stock by product',
        'Receive deliveries and record write-offs',
        'Count stock and make adjustments',
        'Review stock movements and their reasons',
      ]}
    />
  )
}
