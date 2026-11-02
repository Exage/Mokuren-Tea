'use client'

import { ErrorScreen } from '@/app/screens/error'

export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen retry={retry} />
}
