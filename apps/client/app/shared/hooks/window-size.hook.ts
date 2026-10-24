'use client'

import { useSyncExternalStore } from 'react'

type WindowSize = {
  width: number | null
  height: number | null
}

const serverSnapshot: WindowSize = { width: null, height: null }
let snapshot = serverSnapshot

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange)

  return () => window.removeEventListener('resize', onChange)
}

function getSnapshot(): WindowSize {
  const width = window.innerWidth
  const height = window.innerHeight

  // React requires the same snapshot reference until the dimensions change.
  if (snapshot.width !== width || snapshot.height !== height) {
    snapshot = { width, height }
  }

  return snapshot
}

function getServerSnapshot() {
  return serverSnapshot
}

export function useWindowSizeHook() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
