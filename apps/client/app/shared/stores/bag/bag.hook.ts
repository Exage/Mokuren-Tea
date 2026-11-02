'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { BAG_STORAGE_KEY, useBagStore } from './bag.store'

const subscribeHydration = (onChange: () => void) => {
  const unsubscribeStart = useBagStore.persist.onHydrate(onChange)
  const unsubscribeFinish = useBagStore.persist.onFinishHydration(onChange)
  return () => {
    unsubscribeStart()
    unsubscribeFinish()
  }
}

export function useBagHydrationHook() {
  const hasHydrated = useSyncExternalStore(
    subscribeHydration,
    useBagStore.persist.hasHydrated,
    () => false
  )

  useEffect(() => {
    if (!useBagStore.persist.hasHydrated()) {
      void useBagStore.persist.rehydrate()
    }
  }, [])

  return hasHydrated
}

// Mount once in the shared header to keep other browser tabs in sync.
export function useBagStorageSyncHook() {
  useEffect(() => {
    const syncBag = (event: StorageEvent) => {
      if (
        event.storageArea === window.localStorage &&
        (!event.key || event.key === BAG_STORAGE_KEY)
      ) {
        void useBagStore.persist.rehydrate()
      }
    }
    window.addEventListener('storage', syncBag)
    return () => window.removeEventListener('storage', syncBag)
  }, [])
}
