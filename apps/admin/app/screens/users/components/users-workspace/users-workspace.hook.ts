import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Administrator, AdministratorCredentials } from '@/app/shared/api/types/administration'
import {
  createAdministrator,
  listAdministrators,
  resetAdministratorPassword,
  revokeAdministratorSessions,
  updateAdministrator,
} from '@/app/shared/api/requests/administrators'
import { useCatalogListHook, useCatalogMutationHook } from '@/app/shared/hooks/catalog-data.hook'
import { AdminAuthError } from '@/app/shared/api/requests/admin-auth'

type Dialog =
  | { type: 'create' }
  | { type: 'edit'; user: Administrator }
  | { type: 'access' | 'reset' | 'revoke'; user: Administrator }
  | { type: 'credentials'; credentials: AdministratorCredentials }

export function useUsersWorkspaceHook(currentUserId: string) {
  const users = useCatalogListHook(listAdministrators)
  const mutation = useCatalogMutationHook()
  const [dialog, setDialog] = useState<Dialog | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialog || (dialog.type !== 'create' && dialog.type !== 'edit')) {
      return
    }
    const form = new FormData(event.currentTarget)
    const displayName = String(form.get('displayName') || '').trim()
    const login = String(form.get('login') || '').trim()
    void mutation.run(
      async () => {
        if (!displayName || (dialog.type === 'create' && !login)) {
          throw new AdminAuthError(
            400,
            'VALIDATION_ERROR',
            'Login and display name must not be blank.'
          )
        }
        if (dialog.type === 'create') {
          const credentials = await createAdministrator({ login, displayName })
          setDialog({ type: 'credentials', credentials })
        } else {
          await updateAdministrator(dialog.user.id, { displayName })
          setDialog(null)
        }
        users.refresh()
      },
      dialog.type === 'create' ? 'Administrator created.' : 'Administrator updated.'
    )
  }

  function confirm() {
    if (!dialog || !('user' in dialog)) {
      return
    }
    const { user, type } = dialog
    void mutation.run(
      async () => {
        if (type === 'reset') {
          const credentials = await resetAdministratorPassword(user.id)
          setDialog({ type: 'credentials', credentials })
        } else {
          if (type === 'access') {
            await updateAdministrator(user.id, { isActive: !user.isActive })
          } else if (type === 'revoke') {
            await revokeAdministratorSessions(user.id)
            if (user.id === currentUserId) {
              window.location.replace('/login')
            }
          }
          setDialog(null)
        }
        users.refresh()
      },
      type === 'reset'
        ? 'Temporary password issued.'
        : type === 'revoke'
          ? 'Sessions revoked.'
          : 'Access updated.'
    )
  }

  function openDialog(next: Dialog | null) {
    if (mutation.busy) {
      return
    }
    mutation.clearFeedback()
    setDialog(next)
  }

  return { users, mutation, dialog, setDialog: openDialog, submit, confirm }
}
