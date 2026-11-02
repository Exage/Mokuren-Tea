import { useEffect, useState } from 'react'
import { getDashboard } from '@/app/shared/api/requests/dashboard'
import { catalogError } from '@/app/shared/api/requests/catalog-request'
import type { Dashboard } from '@/app/shared/api/types/reservations'

export function useOverviewWorkspaceHook() {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    revision: number
    data: Dashboard | null
    error: string
  } | null>(null)
  const loading = result?.revision !== revision
  useEffect(() => {
    const controller = new AbortController()
    getDashboard(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ revision, data, error: '' })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ revision, data: null, error: catalogError(error) })
        }
      })
    return () => controller.abort()
  }, [revision])
  return {
    loading,
    data: loading ? null : result?.data,
    error: loading ? '' : result?.error,
    refresh: () => setRevision((value) => value + 1),
  }
}
