import { Button } from '@mokuren/ui/button'
import { AuthFrame } from '@/app/shared/components/auth-frame'

export function NotFoundScreen() {
  return (
    <AuthFrame title="Page not found" description="Return to the overview to continue.">
      <Button href="/">Back to overview</Button>
    </AuthFrame>
  )
}
