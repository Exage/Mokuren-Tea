import type { ComponentPropsWithoutRef } from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import styles from './button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outlineLight'

type ButtonProps = (ComponentPropsWithoutRef<'button'> | ComponentPropsWithoutRef<typeof Link>) & {
  variant?: ButtonVariant
}

export function Button({ className, children, variant = 'primary', ...props }: ButtonProps) {
  const buttonClassName = clsx(styles.button, styles[variant], className)

  if ('href' in props) {
    return (
      <Link className={buttonClassName} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button className={buttonClassName} {...props}>
      {children}
    </button>
  )
}
