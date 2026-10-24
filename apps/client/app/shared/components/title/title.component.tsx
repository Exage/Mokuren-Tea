import type { ComponentPropsWithoutRef } from 'react'
import clsx from 'clsx'
import styles from './title.module.css'

type TitleSize = '3xl' | '2xl' | 'xl' | 'lg' | 'md'

type TitleProps = ComponentPropsWithoutRef<'h1'> & {
  size: TitleSize
}

const TITLE_ELEMENT: Record<TitleSize, 'h1' | 'h2' | 'h3'> = {
  '3xl': 'h1',
  '2xl': 'h1',
  xl: 'h2',
  lg: 'h3',
  md: 'h3',
}

const TITLE_SIZE_CLASS: Record<TitleSize, string> = {
  '3xl': styles.size3xl,
  '2xl': styles.size2xl,
  xl: styles.sizeXl,
  lg: styles.sizeLg,
  md: styles.sizeMd,
}

export function Title({ size, className, children, ...props }: TitleProps) {
  const Element = TITLE_ELEMENT[size]

  return (
    <Element className={clsx(styles.title, TITLE_SIZE_CLASS[size], className)} {...props}>
      {children}
    </Element>
  )
}

export type { TitleProps, TitleSize }
