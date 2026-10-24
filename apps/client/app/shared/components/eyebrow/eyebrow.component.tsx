import type { ComponentPropsWithoutRef } from 'react'
import clsx from 'clsx'
import styles from './eyebrow.module.css'

type EyebrowProps = ComponentPropsWithoutRef<'p'>

export function Eyebrow({ className, children, ...props }: EyebrowProps) {
  return (
    <p className={clsx(styles.eyebrow, className)} {...props}>
      {children}
    </p>
  )
}

export type { EyebrowProps }
