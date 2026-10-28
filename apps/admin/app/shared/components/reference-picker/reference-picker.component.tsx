'use client'
import Image from 'next/image'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import { Checkbox } from '@mokuren/ui/checkbox'
import { CatalogFeedback, CatalogPagination } from '../catalog-ui'
import { useReferencePickerHook } from './reference-picker.hook'
import type { ReferenceKind } from './reference-picker.hook'
import styles from '../catalog-ui/catalog-ui.module.css'

export function ReferencePicker({
  kind,
  label,
  values,
  onChange,
  multiple = false,
  exclude,
  labels = {},
  disabled = false,
}: {
  kind: ReferenceKind
  label: string
  values: string[]
  onChange: (values: string[]) => void
  multiple?: boolean
  exclude?: string
  labels?: Record<string, string>
  disabled?: boolean
}) {
  const list = useReferencePickerHook(kind)
  return (
    <details className={styles.card}>
      <summary>
        {label} · {values.length} selected
      </summary>
      <p className={styles.muted}>
        {values.length
          ? values.map((id) => labels[id] || list.names[id] || id).join(', ')
          : 'None selected'}
      </p>
      {!!values.length && (
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange([])}>
          Clear selection
        </Button>
      )}
      {/* This control may be nested in an editor form, so search is handled without a nested form. */}
      <label className={styles.field}>
        Find {label.toLowerCase()}
        <Input
          type="search"
          maxLength={300}
          disabled={disabled}
          onChange={(event) => list.setQuerySearch(event.target.value)}
          onKeyDown={list.preventSearchSubmit}
        />
      </label>
      <CatalogFeedback error={list.error} loading={list.loading} />
      {list.error && (
        <Button type="button" variant="ghost" onClick={list.refresh}>
          Retry
        </Button>
      )}
      {list.data?.items
        .filter((item) => item.id !== exclude)
        .map((item) => (
          <label className={styles.check} key={item.id}>
            <Checkbox
              checked={values.includes(item.id)}
              disabled={disabled || (!values.includes(item.id) && multiple && values.length >= 50)}
              onChange={() =>
                onChange(
                  values.includes(item.id)
                    ? values.filter((id) => id !== item.id)
                    : multiple
                      ? [...values, item.id]
                      : [item.id]
                )
              }
            />
            {item.url && (
              <Image
                unoptimized
                className={styles.image}
                src={item.url}
                alt=""
                width={80}
                height={80}
              />
            )}
            <span>{item.name}</span>
          </label>
        ))}
      {list.data?.items.length === 0 && <p>No matches.</p>}
      <CatalogPagination
        pagination={list.data?.pagination}
        onPage={list.setPage}
        disabled={disabled || list.loading}
      />
    </details>
  )
}
