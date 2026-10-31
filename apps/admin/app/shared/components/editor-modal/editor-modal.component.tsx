'use client'

import type { ReactNode } from 'react'
import { Button } from '@mokuren/ui/button'
import { useEditorModalHook } from './editor-modal.hook'
import styles from './editor-modal.module.css'

export function EditorModal({
  children,
  label,
  onClose,
  busy = false,
  open = true,
}: {
  children: ReactNode
  label: string
  onClose: () => void
  busy?: boolean
  open?: boolean
}) {
  const ref = useEditorModalHook(open)
  if (!open) {
    return children
  }
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={label}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) {
          return
        }
        const bounds = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) {
          onClose()
        }
      }}
    >
      <div className={styles.header}>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          Close
        </Button>
      </div>
      {children}
    </dialog>
  )
}
