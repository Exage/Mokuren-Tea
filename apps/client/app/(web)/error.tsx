'use client'

import { Button } from '@mokuren/ui/button'
import { Container } from '@/app/shared/components/container'
import { Title } from '@/app/shared/components/title'

export default function PageError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main>
      <Container>
        <Title size="lg">This page is temporarily unavailable.</Title>
        <p>Please try again in a moment.</p>
        <Button onClick={reset}>Try again</Button>
      </Container>
    </main>
  )
}
