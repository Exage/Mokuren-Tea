'use client'

import { Button } from '@mokuren/ui/button'
import { Description } from '@/app/shared/components/description'
import { ProductCard } from '@/app/shared/components/product-card'
import { Select } from '@mokuren/ui/select'
import { Input } from '@mokuren/ui/input'
import { Title } from '@/app/shared/components/title'
import { FilterFields } from '../filter-fields'
import type { CatalogInitialData } from '@/app/shared/api/types/catalog'
import { SORT_OPTIONS, useCatalogResultsHook } from './catalog-results.hook'
import styles from './catalog-results.module.css'

export function CatalogResults({ initial }: { initial: CatalogInitialData }) {
  const {
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
    result,
    page,
    setPage,
    filterCount,
    hasFilters,
    normalizePrices,
    clearFilters,
  } = useCatalogResultsHook(initial)

  const products = result.data?.items || []
  const pagination = result.data?.pagination

  const filterProps = {
    minPrice,
    maxPrice,
    tastes,
    tasteOptions: initial.tastes,
    onMinPriceChange: setMinPrice,
    onMaxPriceChange: setMaxPrice,
    onPriceBlur: normalizePrices,
    onTasteToggle: toggleTaste,
  }

  return (
    <>
      <div className={styles.categories} role="group" aria-label="Tea categories">
        <button
          type="button"
          className={styles.category}
          aria-pressed={!category}
          onClick={() => setCategory('')}
        >
          All Teas
        </button>
        {initial.categories.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.category}
            aria-pressed={category === item.slug}
            onClick={() => setCategory(item.slug)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <Input
            id={`${id}-search`}
            name="search"
            type="search"
            maxLength={200}
            aria-label="Search teas"
            placeholder="Search teas..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          aria-haspopup="dialog"
          aria-expanded={isDrawerOpen}
          aria-controls={`${id}-drawer`}
          onClick={openDrawer}
        >
          Filters {filterCount > 0 && <span className={styles.badge}>{filterCount}</span>}
        </Button>
        <span className={styles.count} role="status" aria-live="polite">
          {result.isFetching
            ? 'Loading teas…'
            : result.isError
              ? 'Could not load teas'
              : `${pagination?.totalItems || 0} tea${pagination?.totalItems === 1 ? '' : 's'}`}
        </span>
        <div className={styles.sort}>
          <label htmlFor={`${id}-sort`}>Sort</label>
          <Select
            id={`${id}-sort`}
            className={styles.sortControl}
            aria-label="Sort products"
            value={sort}
            onValueChange={setSort}
            options={SORT_OPTIONS}
          />
        </div>
        <button
          type="button"
          className={styles.clear}
          onClick={clearFilters}
          disabled={!hasFilters}
        >
          Clear filters
        </button>
      </div>

      {result.isError ? (
        <div className={styles.empty} role="alert">
          <Title className={styles.emptyTitle} size="lg">
            Could not load teas.
          </Title>
          <Description>Please try again.</Description>
          <Button variant="secondary" onClick={() => result.refetch()}>
            Try again
          </Button>
        </div>
      ) : result.isPending ? (
        <div className={styles.empty} role="status">
          Loading teas…
        </div>
      ) : products.length > 0 ? (
        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              sizes="(max-width: 400px) calc(100vw - 3.2rem), (max-width: 560px) calc((100vw - 4.4rem) / 2), (max-width: 1024px) calc((100vw - 6.8rem) / 2), (max-width: 1280px) calc((min(100vw, 1200px) - 8.8rem) / 3), 27.3rem"
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <Title className={styles.emptyTitle} size="lg">
            No teas found.
          </Title>
          <Description>Try adjusting your filters or explore another category.</Description>
          <Button variant="secondary" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Catalog pages">
          <Button
            variant="secondary"
            disabled={page <= 1 || result.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= pagination.totalPages || result.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}

      <dialog
        ref={drawerRef}
        id={`${id}-drawer`}
        className={styles.drawer}
        aria-labelledby={`${id}-drawer-title`}
        aria-describedby={`${id}-drawer-description`}
        onCancel={cancelDrawer}
        onClick={dismissDrawer}
      >
        <div className={styles.drawerHeading}>
          <Title id={`${id}-drawer-title`} className={styles.drawerTitle} size="lg">
            Filters
          </Title>
          <button
            type="button"
            className={styles.close}
            aria-label="Close filters"
            onClick={closeDrawer}
          >
            ×
          </button>
        </div>
        <Description id={`${id}-drawer-description`} className={styles.drawerDescription}>
          Refine the tea selection.
        </Description>
        <FilterFields group="all" {...filterProps} />
        <div className={styles.drawerActions}>
          <Button variant="ghost" onClick={clearFilters}>
            Clear all
          </Button>
          <Button onClick={closeDrawer}>Show teas</Button>
        </div>
      </dialog>
    </>
  )
}
