import clsx from 'clsx'
import styles from './skeleton.module.css'

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx(styles.skeleton, className)} aria-hidden="true" />
}
