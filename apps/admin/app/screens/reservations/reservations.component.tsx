import { SectionPreview } from '@/app/shared/components/section-preview'

export function ReservationsScreen() {
  return (
    <SectionPreview
      eyebrow="Store"
      title="Reservations"
      description="Manage pickup reservations from request to collection."
      features={[
        'Browse reservations and view their details',
        'Create and edit new reservations',
        'Confirm, mark ready, complete, or cancel reservations',
        'Review reservation history and events',
      ]}
    />
  )
}
