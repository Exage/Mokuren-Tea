'use client'

import { Button } from '@mokuren/ui/button'
import { Input } from '@mokuren/ui/input'
import type { AdminUser } from '@/app/shared/api/types/admin-auth'
import { AuthFrame } from '@/app/shared/components/auth-frame'
import { SessionControls } from '@/app/shared/components/session-controls'
import { useAuthFormHook } from './auth-form.hook'
import styles from './auth-form.module.css'

export function AuthForm({ mode, user }: { mode: 'login' | 'change-password'; user?: AdminUser }) {
  const changingPassword = mode === 'change-password'
  const { isSubmitting, error, handleSubmit } = useAuthFormHook(mode)

  return (
    <AuthFrame
      title={changingPassword ? 'Change password' : 'Welcome back'}
      description={
        changingPassword
          ? user?.mustChangePassword
            ? 'Set a new password before continuing to store administration.'
            : 'Choose a new password for your administrator account.'
          : 'Sign in to manage your store.'
      }
    >
      <form onSubmit={handleSubmit} className={styles.form} aria-busy={isSubmitting}>
        <fieldset className={styles.fields} disabled={isSubmitting}>
          {changingPassword ? (
            <>
              <Input
                type="hidden"
                name="username"
                autoComplete="username"
                value={user?.login || ''}
              />
              <label className={styles.field} htmlFor="current-password">
                Current password
                <Input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
            </>
          ) : (
            <label className={styles.field} htmlFor="login">
              Login
              <Input
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
          )}
          <label className={styles.field} htmlFor="password">
            {changingPassword ? 'New password' : 'Password'}
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={changingPassword ? 'new-password' : 'current-password'}
              required
            />
          </label>
          {changingPassword && (
            <label className={styles.field} htmlFor="confirm-password">
              Confirm new password
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          )}
        </fieldset>
        {error && (
          <p id="auth-error" role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          aria-describedby={error ? 'auth-error' : undefined}
        >
          {isSubmitting ? 'Please wait…' : changingPassword ? 'Save password' : 'Sign in'}
        </Button>
        {changingPassword && !user?.mustChangePassword && (
          <Button href="/" variant="ghost">
            Back to overview
          </Button>
        )}
      </form>
      {user && <SessionControls user={user} showPasswordLink={false} />}
    </AuthFrame>
  )
}
