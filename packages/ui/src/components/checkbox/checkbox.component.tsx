import type { ComponentPropsWithRef } from 'react'
import clsx from 'clsx'
import styles from './checkbox.module.css'

export function Checkbox({ className, ...props }: Omit<ComponentPropsWithRef<'input'>, 'type'>) {
  return <input {...props} type="checkbox" className={clsx(styles.checkbox, className)} />
}
