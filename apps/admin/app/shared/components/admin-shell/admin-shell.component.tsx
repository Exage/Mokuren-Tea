import type { ReactNode } from 'react'
import Link from 'next/link'
import { AdminNavigation } from '@/app/shared/components/admin-navigation'
import type { AdminUser } from '@/app/shared/api/types/admin-auth'
import { SessionControls } from '@/app/shared/components/session-controls'
import styles from './admin-shell.module.css'

export function AdminShell({ children, user }: { children: ReactNode; user: AdminUser }) {
  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} aria-label="Mokuren Tea overview">
          Mokuren Tea
        </Link>
        <AdminNavigation />
        <SessionControls user={user} />
      </aside>
      <div className={styles.workspace}>
        <main id="main-content" className={styles.main} tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
