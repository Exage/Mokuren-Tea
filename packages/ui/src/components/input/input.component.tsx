import type { ComponentPropsWithRef } from 'react'
import clsx from 'clsx'
import styles from './input.module.css'

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input className={clsx(styles.input, className)} {...props} />
}
