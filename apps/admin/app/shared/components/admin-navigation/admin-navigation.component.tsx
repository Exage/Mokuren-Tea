'use client'

import Link from 'next/link'
import clsx from 'clsx'
import { navigation } from '@/app/shared/constants/navigation'
import { useAdminNavigationHook } from './admin-navigation.hook'
import styles from './admin-navigation.module.css'

export function AdminNavigation() {
  const { isActive } = useAdminNavigationHook()

  return (
    <nav className={styles.navigation} aria-label="Main navigation">
      <ul className={styles.list}>
        {navigation.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={clsx(styles.link, isActive(item.href) && styles.active)}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
