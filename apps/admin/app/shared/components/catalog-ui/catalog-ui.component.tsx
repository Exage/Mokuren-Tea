import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import clsx from 'clsx'
import type { FormEvent } from 'react'
import type { Pagination } from '../../api/types/catalog'
import styles from './catalog-ui.module.css'

export function CatalogFeedback({
  error,
  notice,
  loading,
  floating = false,
}: {
  error?: string
  notice?: string
  loading?: boolean
  floating?: boolean
}) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className={clsx(styles.error, floating && [styles.toast, styles.toastError])}
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.toast}>
          {notice}
        </p>
      )}
      {loading && <p role="status">Loading…</p>}
    </>
  )
}
export function CatalogSearch({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  disabled?: boolean
}) {
  return (
    <form className={styles.search} onSubmit={onSubmit} role="search">
      <label className={styles.field}>
        Search
        <Input
          className={styles.searchInput}
          name="search"
          type="search"
          maxLength={300}
          placeholder="Search by name"
          disabled={disabled}
        />
      </label>
      <Button type="submit" variant="secondary" disabled={disabled}>
        Search
      </Button>
    </form>
  )
}
export function CatalogPagination({
  pagination,
  onPage,
  disabled = false,
}: {
  pagination?: Pagination
  onPage: (page: number) => void
  disabled?: boolean
}) {
  if (!pagination) {
    return null
  }
  return (
    <nav className={styles.actions} aria-label="Pagination">
      <Button
        type="button"
        variant="ghost"
        disabled={disabled || pagination.page <= 1}
        onClick={() => onPage(pagination.page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.totalItems}{' '}
        items
      </span>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled || pagination.page >= pagination.totalPages}
        onClick={() => onPage(pagination.page + 1)}
      >
        Next
      </Button>
    </nav>
  )
}
