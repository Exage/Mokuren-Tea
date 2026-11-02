'use client'

import { Button } from '@mokuren/ui/button'
import { StatusPanel } from '@/app/shared/components/status-panel'
import { useErrorScreenHook } from './error.hook'

export function ErrorScreen({ retry }: { retry: () => void }) {
  const { isRetrying, tryAgain } = useErrorScreenHook(retry)
  return (
    <StatusPanel
      eyebrow="A brief pause"
      title="Let’s try that again."
      description="This page is temporarily unavailable. Please try again in a moment, or return to the home page."
    >
      <Button type="button" onClick={tryAgain} disabled={isRetrying} aria-busy={isRetrying}>
        {isRetrying ? 'Trying again…' : 'Try again'}
      </Button>
      <Button href="/" variant="ghost">
        Back to home
      </Button>
    </StatusPanel>
  )
}
