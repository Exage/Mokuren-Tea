import type { ComponentPropsWithRef } from 'react'
import clsx from 'clsx'
import styles from './dropdown-trigger.module.css'

export function DropdownTrigger({
  children,
  className,
  type = 'button',
  ...props
}: ComponentPropsWithRef<'button'>) {
  return (
    <button type={type} className={clsx(styles.trigger, className)} {...props}>
      <span className={styles.label}>{children}</span>
      <svg
        className={styles.arrow}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </button>
  )
}
