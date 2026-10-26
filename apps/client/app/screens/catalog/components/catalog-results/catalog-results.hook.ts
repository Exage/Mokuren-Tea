'use client'

import { useEffect, useId, useRef, useState, type MouseEvent, type SyntheticEvent } from 'react'
import { MOCK_PRODUCTS } from '@/app/shared/mocks/products'

export const CATEGORIES = [
  'All Teas',
  'Green Tea',
  'Black Tea',
  'Oolong',
  'Pu-erh',
  'Herbal',
  'Fruit Infusions',
]
export const TASTES = [
  'Floral',
  'Earthy',
  'Sweet',
  'Fresh',
  'Nutty',
  'Fruity',
  'Bold',
  'Grassy',
  'Creamy',
]
export type CatalogSort = 'featured' | 'price-asc' | 'price-desc' | 'name'

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name: A to Z' },
] as const

export function useCatalogResultsHook() {
  const id = useId()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All Teas')
  const [minPrice, setMinPrice] = useState('0')
  const [maxPrice, setMaxPrice] = useState('30')
  const [tastes, setTastes] = useState<string[]>([])
  const [sort, setSort] = useState<CatalogSort>('featured')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDialogElement>(null)

  const firstPrice = Math.max(0, Math.min(30, Number(minPrice) || 0))
  const secondPrice = Math.max(0, Math.min(30, maxPrice.trim() ? Number(maxPrice) || 0 : 30))
  const lowerPrice = Math.min(firstPrice, secondPrice)
  const upperPrice = Math.max(firstPrice, secondPrice)
  const hasPriceFilter = lowerPrice > 0 || upperPrice < 30
  const filterCount = Number(hasPriceFilter) + tastes.length
  const hasFilters = Boolean(query.trim() || category !== 'All Teas' || filterCount)
  const search = query.trim().toLowerCase()
  const products = MOCK_PRODUCTS.filter((product) => {
    const searchable = [
      product.name,
      product.category,
      product.origin,
      product.description,
      ...product.tastes,
    ]
      .join(' ')
      .toLowerCase()
    return (
      (!search || searchable.includes(search)) &&
      (category === 'All Teas' || category === product.category) &&
      product.price >= lowerPrice &&
      product.price <= upperPrice &&
      tastes.every((taste) => product.tastes.includes(taste))
    )
  })

  if (sort === 'price-asc') {
    products.sort((a, b) => a.price - b.price)
  } else if (sort === 'price-desc') {
    products.sort((a, b) => b.price - a.price)
  } else if (sort === 'name') {
    products.sort((a, b) => a.name.localeCompare(b.name, 'en'))
  }

  const normalizePrices = () => {
    setMinPrice(String(lowerPrice))
    setMaxPrice(String(upperPrice))
  }

  const toggleTaste = (taste: string) => {
    setTastes((previous) =>
      previous.includes(taste) ? previous.filter((value) => value !== taste) : [...previous, taste]
    )
  }

  const clearFilters = () => {
    setQuery('')
    setCategory('All Teas')
    setMinPrice('0')
    setMaxPrice('30')
    setTastes([])
    setSort('featured')
  }

  const openDrawer = () => {
    setIsDrawerOpen(true)
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
    setCategory,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    tastes,
    toggleTaste,
    sort,
    setSort,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    cancelDrawer,
    dismissDrawer,
    drawerRef,
    products,
    filterCount,
    hasFilters,
    normalizePrices,
    clearFilters,
  }
}
