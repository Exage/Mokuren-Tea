import type { ComponentPropsWithRef } from 'react'
import clsx from 'clsx'
import styles from './textarea.module.css'

export function Textarea({ className, ...props }: ComponentPropsWithRef<'textarea'>) {
  return <textarea className={clsx(styles.textarea, className)} {...props} />
}
