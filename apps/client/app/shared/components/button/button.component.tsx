import type { ComponentPropsWithoutRef } from 'react'
import clsx from 'clsx'
import styles from './button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outlineLight'

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
}

export function Button({ className, children, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button className={clsx(styles.button, styles[variant], className)} {...props}>
      {children}
    </button>
  )
}
