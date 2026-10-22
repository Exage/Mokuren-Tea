import type { ComponentPropsWithoutRef } from 'react'
import clsx from 'clsx'
import styles from './container.module.css'

type ContainerProps = ComponentPropsWithoutRef<'div'>

export function Container({ className, children, ...props }: ContainerProps) {
  return (
    <div className={clsx(styles.container, className)} {...props}>
      {children}
    </div>
  )
}
