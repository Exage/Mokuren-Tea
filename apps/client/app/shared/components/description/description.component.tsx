import type { ComponentPropsWithoutRef } from 'react'
import clsx from 'clsx'
import styles from './description.module.css'

type DescriptionProps = ComponentPropsWithoutRef<'p'>

export function Description({ className, children, ...props }: DescriptionProps) {
  return (
    <p className={clsx(styles.description, className)} {...props}>
      {children}
    </p>
  )
}

export type { DescriptionProps }
