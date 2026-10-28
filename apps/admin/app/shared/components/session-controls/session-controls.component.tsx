'use client'

import Link from 'next/link'
import { Button } from '@mokuren/ui/button'
import type { AdminUser } from '@/app/shared/api/types/admin-auth'
import { useSessionControlsHook } from './session-controls.hook'
import styles from './session-controls.module.css'

export function SessionControls({
  user,
  showPasswordLink = true,
}: {
  user: AdminUser
  showPasswordLink?: boolean
}) {
  const { isSubmitting, error, handleLogout } = useSessionControlsHook()
  return (
    <div className={styles.session}>
      <p className={styles.login}>{user.login}</p>
      {showPasswordLink && !user.mustChangePassword && (
        <Link href="/change-password" className={styles.link}>
          Change password
        </Link>
      )}
      <Button variant="ghost" type="button" onClick={handleLogout} disabled={isSubmitting}>
        {isSubmitting ? 'Signing out…' : 'Sign out'}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
