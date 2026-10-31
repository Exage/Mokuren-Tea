import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AdminAuthError } from '@/app/shared/api/requests/admin-auth'
import {
  listCmsBlocks,
  listCmsRevisions,
  previewCmsPage,
  publishCmsBlock,
  restoreCmsRevision,
  saveCmsDraft,
} from '@/app/shared/api/requests/cms'
import { catalogError } from '@/app/shared/api/requests/catalog-request'
import type { CmsBlock, CmsContent, CmsPreview, CmsRevision } from '@/app/shared/api/types/cms'
import { useCatalogListHook, useCatalogMutationHook } from '@/app/shared/hooks/catalog-data.hook'
import type { ListQuery } from '@/app/shared/api/types/catalog'

const loadBlocks = (_query: ListQuery, signal: AbortSignal) => listCmsBlocks(signal)
export function useContentWorkspaceHook() {
  const list = useCatalogListHook(loadBlocks)
  const [selected, setSelected] = useState('home.hero')
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [editorVersion, setEditorVersion] = useState(0)
  const [savedBlock, setSavedBlock] = useState<CmsBlock | null>(null)
  const mutation = useCatalogMutationHook()
  const blocks =
    list.data?.items.map((block) =>
      savedBlock?.blockKey === block.blockKey ? savedBlock : block
    ) || []
  const block = blocks.find((item) => item.blockKey === selected)
  function select(key: string) {
    if (mutation.busy || key === selected) {
      return
    }
    if (dirty) {
      setPending(key)
    } else {
      setSelected(key)
    }
  }
  function refresh() {
    if (dirty) {
      setPending('reload')
    } else {
      reload()
    }
  }
  function reload() {
    setSavedBlock(null)
    setEditorVersion((value) => value + 1)
    list.refresh()
  }
  function discard() {
    setDirty(false)
    if (pending === 'reload') {
      reload()
    } else if (pending) {
      setSelected(pending)
    }
    setPending(null)
  }
  function saved(value: CmsBlock) {
    setSavedBlock(value)
    setDirty(false)
    list.refresh()
  }
  return {
    list,
    blocks,
    block,
    selected,
    select,
    dirty,
    setDirty,
    pending,
    setPending,
    discard,
    refresh,
    editorVersion,
    saved,
    mutation,
  }
}

function initialContent(block: CmsBlock): CmsContent {
  const initial =
    block.draft ||
    block.published ||
    (block.blockKey === 'home.testimonials'
      ? { testimonials: [] }
      : block.blockKey === 'home.featuredTeas'
        ? { teaIds: [] }
        : {})
  const content: Record<string, unknown> = { ...initial }
  for (const key of ['address', 'hours', 'phone', 'email', 'location'] as const) {
    delete content[key]
  }
  return content as CmsContent
}
export function useContentEditorHook(
  block: CmsBlock,
  onSaved: (block: CmsBlock) => void,
  onDirty: (value: boolean) => void,
  mutation: ReturnType<typeof useCatalogMutationHook>
) {
  const initial = initialContent(block)
  const [content, setContent] = useState<CmsContent>(initial)
  const dirty = JSON.stringify(content) !== JSON.stringify(initial)
  const [confirmation, setConfirmation] = useState<'publish' | CmsRevision | null>(null)
  const [preview, setPreview] = useState<CmsPreview | null>(null)
  const [history, setHistory] = useState<{ items: CmsRevision[]; error: string } | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [conflict, setConflict] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    listCmsRevisions(block, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setHistory({ items: result.items, error: '' })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setHistory({ items: [], error: catalogError(error) })
        }
      })
    return () => controller.abort()
  }, [block, historyVersion])
  useEffect(() => {
    if (!dirty) {
      return
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  function update(patch: Partial<CmsContent>) {
    const next = { ...content, ...patch }
    for (const key of Object.keys(next) as (keyof CmsContent)[]) {
      if (next[key] === '' || next[key] === undefined) {
        delete next[key]
      }
    }
    setContent(next)
    onDirty(JSON.stringify(next) !== JSON.stringify(initial))
    setPreview(null)
  }
  async function guard(action: () => Promise<void>) {
    try {
      await action()
    } catch (error) {
      if (
        error instanceof AdminAuthError &&
        ['STALE_VERSION', 'CONCURRENT_UPDATE'].includes(error.code)
      ) {
        setConflict(true)
        throw new AdminAuthError(
          error.status,
          error.code,
          'This block changed in another session. Refresh content before continuing.'
        )
      }
      throw error
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void mutation.run(
      () => guard(async () => onSaved(await saveCmsDraft(block, content))),
      'Draft saved. Your live website is unchanged.'
    )
  }
  function confirm() {
    if (!confirmation) {
      return
    }
    const action = confirmation
    void mutation.run(
      () =>
        guard(async () => {
          onSaved(
            action === 'publish'
              ? await publishCmsBlock(block)
              : await restoreCmsRevision(block, action.id)
          )
          setConfirmation(null)
        }),
      action === 'publish'
        ? 'Content published.'
        : 'Revision restored to draft. Review it before publishing.'
    )
  }
  function showPreview() {
    void mutation.run(async () => setPreview(await previewCmsPage(block)), '')
  }
  return {
    content,
    update,
    dirty,
    conflict,
    confirmation,
    setConfirmation,
    confirm,
    preview,
    setPreview,
    showPreview,
    history,
    retryHistory: () => setHistoryVersion((value) => value + 1),
    save,
  }
}
