'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import {
  CatalogFeedback,
  CatalogPagination,
  CatalogSearch,
} from '@/app/shared/components/catalog-ui'
import { EditorModal } from '@/app/shared/components/editor-modal'
import styles from '@/app/shared/components/catalog-ui/catalog-ui.module.css'
import { useUsersWorkspaceHook } from './users-workspace.hook'
import workspaceStyles from './users-workspace.module.css'

export function UsersWorkspace({ currentUserId }: { currentUserId: string }) {
  const { users, mutation, dialog, setDialog, submit, confirm } =
    useUsersWorkspaceHook(currentUserId)
  const locked = mutation.busy || !!dialog
  const target = dialog && 'user' in dialog ? dialog.user : null
  const confirmationTitle =
    dialog?.type === 'reset'
      ? 'Reset password'
      : dialog?.type === 'revoke'
        ? 'Revoke sessions'
        : target?.isActive
          ? 'Disable access'
          : 'Enable access'

  return (
    <section className={clsx(styles.panel, styles.stack)} aria-label="Administrator accounts">
      <div className={styles.actions}>
        <Button type="button" disabled={locked} onClick={() => setDialog({ type: 'create' })}>
          Add administrator
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={locked || users.loading}
          onClick={users.refresh}
        >
          Refresh
        </Button>
        <Link href="/change-password">Change my password</Link>
      </div>
      <CatalogSearch onSubmit={users.search} disabled={locked} />
      <CatalogFeedback error={users.error} loading={users.loading} />
      {!dialog && <CatalogFeedback error={mutation.error} notice={mutation.notice} />}
      <div className={styles.scroll}>
        <table className={clsx(styles.table, workspaceStyles.table)}>
          <caption className={styles.muted}>Administrator access and sign-in activity</caption>
          <thead>
            <tr>
              <th scope="col">Administrator</th>
              <th scope="col">Access</th>
              <th scope="col">Last sign-in</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.items.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className={workspaceStyles.identity}>
                    <strong>
                      {user.displayName}
                      {user.id === currentUserId && ' (you)'}
                    </strong>
                    <span className={styles.muted}>{user.login}</span>
                  </div>
                </td>
                <td>
                  <div className={workspaceStyles.identity}>
                    <span
                      className={clsx(
                        workspaceStyles.status,
                        !user.isActive && workspaceStyles.inactive
                      )}
                    >
                      {user.isActive ? 'Active' : 'Disabled'}
                    </span>
                    {user.mustChangePassword && (
                      <span className={styles.muted}>Password change required</span>
                    )}
                  </div>
                </td>
                <td>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-GB') : 'Never'}
                </td>
                <td>
                  <div className={clsx(styles.actions, workspaceStyles.actions)}>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={locked}
                      onClick={() => setDialog({ type: 'edit', user })}
                      aria-label={`Edit ${user.login}`}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={locked || user.id === currentUserId}
                      onClick={() => setDialog({ type: 'access', user })}
                      aria-label={`${user.isActive ? 'Disable' : 'Enable'} ${user.login}`}
                    >
                      {user.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={locked || user.id === currentUserId}
                      onClick={() => setDialog({ type: 'reset', user })}
                      aria-label={`Reset password for ${user.login}`}
                    >
                      Reset password
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={locked}
                      onClick={() => setDialog({ type: 'revoke', user })}
                      aria-label={`Revoke sessions for ${user.login}`}
                    >
                      Revoke sessions
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.data?.items.length === 0 && (
        <p>No administrators found. Try another search or add an administrator.</p>
      )}
      <CatalogPagination
        pagination={users.data?.pagination}
        onPage={users.setPage}
        disabled={locked || users.loading}
      />
      {dialog && (
        <EditorModal
          label={
            dialog.type === 'credentials'
              ? 'Temporary password'
              : dialog.type === 'create'
                ? 'Add administrator'
                : dialog.type === 'edit'
                  ? 'Edit administrator'
                  : confirmationTitle
          }
          onClose={() => setDialog(null)}
          busy={mutation.busy}
        >
          <div className={styles.stack}>
            <CatalogFeedback error={mutation.error} />
            {(dialog.type === 'create' || dialog.type === 'edit') && (
              <form className={styles.stack} onSubmit={submit}>
                <h2>{dialog.type === 'create' ? 'Add administrator' : 'Edit administrator'}</h2>
                <fieldset className={styles.fields} disabled={mutation.busy}>
                  <label className={styles.field}>
                    Login
                    <Input
                      name="login"
                      required
                      maxLength={300}
                      pattern=".*\S.*"
                      defaultValue={target?.login || ''}
                      disabled={dialog.type === 'edit'}
                      autoComplete="off"
                    />
                  </label>
                  <label className={styles.field}>
                    Display name
                    <Input
                      name="displayName"
                      required
                      maxLength={300}
                      pattern=".*\S.*"
                      defaultValue={target?.displayName || ''}
                      autoComplete="off"
                    />
                  </label>
                </fieldset>
                {dialog.type === 'create' && (
                  <p className={styles.muted}>
                    A temporary password will be generated. The administrator must change it on
                    first sign-in.
                  </p>
                )}
                <Button type="submit" disabled={mutation.busy}>
                  {mutation.busy
                    ? 'Saving…'
                    : dialog.type === 'create'
                      ? 'Create administrator'
                      : 'Save changes'}
                </Button>
              </form>
            )}
            {dialog.type === 'credentials' && (
              <>
                <h2>Temporary password</h2>
                <p>
                  Account: <strong>{dialog.credentials.user.login}</strong>
                </p>
                {dialog.credentials.temporaryPassword ? (
                  <>
                    <p>
                      Copy this password and share it securely. It will not be shown again after
                      closing this dialog.
                    </p>
                    <pre className={workspaceStyles.password} aria-label="Temporary password">
                      {dialog.credentials.temporaryPassword}
                    </pre>
                    {dialog.credentials.temporaryPasswordExpiresAt && (
                      <p>
                        Expires:{' '}
                        {new Date(dialog.credentials.temporaryPasswordExpiresAt).toLocaleString(
                          'en-GB'
                        )}
                      </p>
                    )}
                    <p className={styles.muted}>
                      The administrator must choose a new password on first sign-in.
                    </p>
                  </>
                ) : (
                  <p>The administrator account was saved. No temporary password was returned.</p>
                )}
                <Button type="button" onClick={() => setDialog(null)}>
                  Done
                </Button>
              </>
            )}
            {target && dialog.type !== 'edit' && (
              <>
                <h2>{confirmationTitle}</h2>
                <p>
                  Administrator: <strong>{target.displayName}</strong> ({target.login})
                </p>
                <p>
                  {dialog.type === 'reset'
                    ? 'This replaces the current password and signs the administrator out of all sessions. A new temporary password will be shown once.'
                    : dialog.type === 'revoke'
                      ? target.id === currentUserId
                        ? 'This signs you out of all sessions, including this one.'
                        : 'This signs the administrator out of all sessions. They can sign in again with their current password.'
                      : target.isActive
                        ? 'This prevents sign-in and revokes all existing sessions.'
                        : 'This allows the administrator to sign in again.'}
                </p>
                <div className={styles.actions}>
                  <Button type="button" disabled={mutation.busy} onClick={confirm}>
                    {mutation.busy ? 'Updating…' : confirmationTitle}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={mutation.busy}
                    onClick={() => setDialog(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </EditorModal>
      )}
    </section>
  )
}
