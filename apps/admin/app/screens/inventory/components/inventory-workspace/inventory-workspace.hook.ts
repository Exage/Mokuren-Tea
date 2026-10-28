import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  compensateMovement,
  getProductStock,
  listMovements,
  recordStock,
} from '@/app/shared/api/requests/inventory'
import { listProducts } from '@/app/shared/api/requests/products'
import { catalogError } from '@/app/shared/api/requests/catalog-request'
import type { Movement, Page, Product, Stock, StockOperation } from '@/app/shared/api/types/catalog'
import { useCatalogListHook, useCatalogMutationHook } from '@/app/shared/hooks/catalog-data.hook'

export function useInventoryWorkspaceHook() {
  const products = useCatalogListHook(listProducts)
  const [selected, setSelected] = useState<Product | null>(null)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const request = useMemo(() => ({ selected, page, revision }), [selected, page, revision])
  const [result, setResult] = useState<{
    request: typeof request
    stock: Stock | null
    history: Page<Movement> | null
    error: string
  } | null>(null)
  const loading = !!selected && result?.request !== request
  const stock = loading ? null : result?.stock || null
  const history = loading ? null : result?.history || null
  const error = loading ? '' : result?.error || ''
  const mutation = useCatalogMutationHook()
  const [operation, setOperation] = useState<StockOperation>('receipt')
  const [correction, setCorrection] = useState<Movement | null>(null)
  const [pending, setPending] = useState<{
    operation: StockOperation | 'compensate'
    productId: string
    grams: number
    reason: string
    movementId?: string
    key: string
  } | null>(null)
  const retry = useRef<{ fingerprint: string; key: string } | null>(null)
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null)
  const operationFormRef = useRef<HTMLFormElement>(null)
  const stockHeadingRef = useRef<HTMLHeadingElement>(null)
  const wasPending = useRef(false)
  useEffect(() => {
    if (selected) {
      stockHeadingRef.current?.focus()
    }
  }, [selected])
  useEffect(() => {
    if (pending) {
      reviewHeadingRef.current?.focus()
    } else if (wasPending.current) {
      operationFormRef.current
        ?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
        ?.focus()
    }
    wasPending.current = !!pending
  }, [pending])
  useEffect(() => {
    if (!request.selected) {
      return
    }
    const controller = new AbortController()
    Promise.all([
      getProductStock(request.selected.id, controller.signal),
      listMovements(request.selected.id, request.page, controller.signal),
    ])
      .then(([stock, history]) => {
        if (!controller.signal.aborted) {
          setResult({ request, stock, history, error: '' })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ request, stock: null, history: null, error: catalogError(error) })
        }
      })
    return () => controller.abort()
  }, [request])
  function select(product: Product) {
    setSelected(product)
    setPage(1)
    setCorrection(null)
    setPending(null)
  }
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) {
      return
    }
    const form = new FormData(event.currentTarget)
    const input = {
      operation: correction ? ('compensate' as const) : operation,
      productId: selected.id,
      grams: Number(form.get('grams') || 0),
      reason: String(form.get('reason') || '').trim(),
      ...(correction ? { movementId: correction.id } : {}),
    }
    // Keep the key after an uncertain response so retrying cannot apply stock twice.
    const fingerprint = JSON.stringify(input)
    if (retry.current?.fingerprint !== fingerprint) {
      retry.current = { fingerprint, key: crypto.randomUUID() }
    }
    setPending({ ...input, key: retry.current.key })
  }
  function confirm() {
    if (!pending) {
      return
    }
    void mutation.run(async () => {
      if (pending.operation === 'compensate') {
        if (!pending.movementId) {
          return
        }
        await compensateMovement(pending.movementId, pending.reason, pending.key)
      } else {
        await recordStock(
          pending.operation,
          pending.productId,
          pending.grams,
          pending.reason,
          pending.key
        )
      }
      retry.current = null
      setPending(null)
      setCorrection(null)
      setPage(1)
      setRevision((value) => value + 1)
      products.refresh()
    }, 'Stock updated and movement recorded.')
  }
  return {
    products,
    selected,
    select,
    stock,
    history,
    page,
    setPage,
    loading,
    error,
    mutation,
    operation,
    setOperation,
    correction,
    setCorrection,
    pending,
    reviewHeadingRef,
    operationFormRef,
    stockHeadingRef,
    setPending,
    prepare,
    confirm,
    refresh: () => setRevision((value) => value + 1),
  }
}
