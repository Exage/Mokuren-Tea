import { useTransition } from 'react'

export function useErrorScreenHook(retry: () => void) {
  const [isRetrying, startTransition] = useTransition()
  return { isRetrying, tryAgain: () => startTransition(retry) }
}
