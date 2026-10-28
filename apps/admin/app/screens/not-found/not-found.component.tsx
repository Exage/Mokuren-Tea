import { Button } from '@mokuren/ui/button'
import { PageHeading } from '@/app/shared/components/page-heading'

export function NotFoundScreen() {
  return (
    <div>
      <PageHeading
        eyebrow="404"
        title="Page not found"
        description="Choose a section from the menu or return to the overview."
      />
      <Button href="/">Back to overview</Button>
    </div>
  )
}
