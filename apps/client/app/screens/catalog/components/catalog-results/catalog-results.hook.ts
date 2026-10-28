'use client'

import { useEffect, useId, useRef, useState, type MouseEvent, type SyntheticEvent } from 'react'
import { isServer, useQuery } from '@tanstack/react-query'
import { catalogQueryOptions } from '@/app/shared/api/queries/catalog'
import type { CatalogFilter, CatalogInitialData } from '@/app/shared/api/types/catalog'

export type CatalogSort = 'new' | 'price-asc' | 'price-desc'
export const SORT_OPTIONS = [
  { value: 'new', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
] as const

export function useCatalogResultsHook(initial: CatalogInitialData) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [priceFilter, setPriceFilter] = useState<{ minPrice?: number; maxPrice?: number }>({})
  const [tastes, setTastes] = useState<string[]>([])
  const [sort, setSort] = useState<CatalogSort>('new')
  const [page, setPage] = useState(1)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const filter: CatalogFilter = {
    ...(search && { search }),
    ...(category && { category }),
    ...(tastes.length > 0 && { tastes: [...tastes].sort() }),
    ...priceFilter,
    ...(sort !== 'new' && { sort }),
    ...(page > 1 && { page }),
  }
  const isDefault = Object.keys(filter).length === 0
  const result = useQuery({
    ...catalogQueryOptions(filter),
    initialData: isDefault ? initial.products : undefined,
    // Server freshness is managed by getInitialCatalog's cache. Avoid reading
    // the clock during prerendering; the browser keeps its normal query lifetime.
    ...(isServer && { initialDataUpdatedAt: 0, staleTime: 'static' as const }),
  })
  const filterCount = Number(Boolean(minPrice || maxPrice)) + tastes.length
  const hasFilters = Boolean(query.trim() || category || filterCount || sort !== 'new')

  const normalizePrices = () => {
    const parse = (value: string) => {
      const number = Number(value)
      return value.trim() && Number.isFinite(number) && number >= 0
        ? Math.round(number * 100) / 100
        : undefined
    }
    let lower = parse(minPrice)
    let upper = parse(maxPrice)
    if (lower !== undefined && upper !== undefined && lower > upper) {
      ;[lower, upper] = [upper, lower]
    }
    setMinPrice(lower === undefined ? '' : String(lower))
    setMaxPrice(upper === undefined ? '' : String(upper))
    setPriceFilter({
      ...(lower !== undefined && { minPrice: lower }),
      ...(upper !== undefined && { maxPrice: upper }),
    })
    setPage(1)
  }
  const toggleTaste = (taste: string) => {
    setTastes((previous) =>
      previous.includes(taste) ? previous.filter((value) => value !== taste) : [...previous, taste]
    )
    setPage(1)
  }
  const clearFilters = () => {
    setQuery('')
    setSearch('')
    setCategory('')
    setMinPrice('')
    setMaxPrice('')
    setPriceFilter({})
    setTastes([])
    setSort('new')
    setPage(1)
  }
  const closeDrawer = () => setIsDrawerOpen(false)
  const cancelDrawer = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    closeDrawer()
  }
  const dismissDrawer = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      closeDrawer()
    }
  }
  useEffect(() => {
    if (!isDrawerOpen) {
      return
    }
    const drawer = drawerRef.current
    drawer?.showModal()
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      drawer?.close()
      root.style.overflow = previousOverflow
    }
  }, [isDrawerOpen])

  return {
    id,
    query,
    setQuery,
    category,
    setCategory: (value: string) => {
      setCategory(value)
      setPage(1)
    },
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    tastes,
    toggleTaste,
    sort,
    setSort: (value: CatalogSort) => {
      setSort(value)
      setPage(1)
    },
    isDrawerOpen,
    openDrawer: () => setIsDrawerOpen(true),
    closeDrawer,
    cancelDrawer,
    dismissDrawer,
    drawerRef,
    result,
    page,
    setPage,
    filterCount,
    hasFilters,
    normalizePrices,
    clearFilters,
  }
}
