import { useEffect, useRef } from 'react'

export function useEditorModalHook(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!open) {
      return
    }
    const dialog = ref.current
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [open])
  return ref
}
