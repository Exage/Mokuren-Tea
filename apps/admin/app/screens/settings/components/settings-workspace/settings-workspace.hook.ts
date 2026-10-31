import { useEffect, useRef, useState, type FormEvent } from 'react'
import { catalogError } from '@/app/shared/api/requests/catalog-request'
import { getStoreSettings, updateStoreSettings } from '@/app/shared/api/requests/store-settings'
import type { StoreSettings } from '@/app/shared/api/types/store-settings'
import { settingsForm, settingsPatch, type SettingsForm } from './settings-form'

export function useSettingsWorkspaceHook() {
  const [saved, setSaved] = useState<StoreSettings | null>(null)
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  const dirty = !!saved && !!form && JSON.stringify(form) !== JSON.stringify(settingsForm(saved))

  useEffect(() => {
    const controller = new AbortController()
    getStoreSettings(controller.signal)
      .then((settings) => {
        if (!controller.signal.aborted) {
          setSaved(settings)
          setForm(settings ? settingsForm(settings) : null)
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(catalogError(cause))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    if (!dirty && !busy) {
      return
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    function navigate(event: MouseEvent) {
      const target = event.target
      const anchor = target instanceof Element ? target.closest('a[href]') : null
      if (
        !anchor ||
        anchor.hasAttribute('download') ||
        anchor.getAttribute('target') === '_blank' ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return
      }
      if (busy || !window.confirm('Leave Settings and discard your unsaved changes?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', navigate, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', navigate, true)
    }
  }, [dirty, busy])

  function update(patch: Partial<SettingsForm>) {
    setForm((current) => (current ? { ...current, ...patch } : current))
    setNotice('')
    setError('')
  }

  function refresh() {
    if (
      lock.current ||
      (dirty && !window.confirm('Discard your unsaved changes and reload settings?'))
    ) {
      return
    }
    setLoading(true)
    setError('')
    setNotice('')
    setRevision((value) => value + 1)
  }

  function discard() {
    if (saved && !lock.current && window.confirm('Discard your unsaved changes?')) {
      setForm(settingsForm(saved))
      setError('')
      setNotice('')
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || !saved || lock.current || loading) {
      return
    }
    let patch
    try {
      patch = settingsPatch(form, saved)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check the entered settings.')
      return
    }
    if (!Object.keys(patch).length) {
      setForm(settingsForm(saved))
      setNotice('No changes to save.')
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const settings = await updateStoreSettings(patch)
      setSaved(settings)
      setForm(settingsForm(settings))
      setNotice('Store settings saved.')
    } catch (cause) {
      setError(catalogError(cause))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return { saved, form, loading, busy, error, notice, dirty, update, refresh, discard, save }
}
