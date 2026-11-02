import { Button } from '@mokuren/ui/button'
import { StatusPanel } from '@/app/shared/components/status-panel'

export function NotFoundScreen() {
  return (
    <StatusPanel
      eyebrow="404 · Page not found"
      title="A different path to your next cup."
      description="We couldn’t find this page. It may have moved, or this tea may no longer be available. Explore the collection to find your next favorite."
    >
      <Button href="/catalog">Explore Teas</Button>
      <Button href="/" variant="ghost">
        Back to home
      </Button>
    </StatusPanel>
  )
}
