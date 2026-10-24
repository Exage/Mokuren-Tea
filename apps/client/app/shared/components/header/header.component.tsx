'use client'

import type { ComponentPropsWithoutRef } from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import { Container } from '@/app/shared/components/container'
import { NAVIGATION } from '@/app/shared/constants/navigation'
import { useHeaderHook } from './header.hook'
import styles from './header.module.css'

export type HeaderProps = ComponentPropsWithoutRef<'header'> & {
  bagCount?: number
}

export function Header({ className, bagCount = 0, ...props }: HeaderProps) {
  const {
    pathname,
    mobilePanelId,
    headerRef,
    menuButtonRef,
    isMenuOpen,
    isScrolled,
    closeMenu,
    toggleMenu,
  } = useHeaderHook()
  const bagLink = NAVIGATION.links.find((link) => link.id === 'bag')

  return (
    <header
      {...props}
      ref={headerRef}
      className={clsx(
        styles.header,
        isScrolled && styles.scrolled,
        isMenuOpen && styles.menuOpen,
        className
      )}
      role={isMenuOpen ? 'dialog' : undefined}
      aria-modal={isMenuOpen || undefined}
      aria-label={isMenuOpen ? 'Navigation menu' : props['aria-label']}
    >
      <Container className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Mokuren Tea home" onClick={closeMenu}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 10h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-6Z" />
              <path d="M17 11h2a2.5 2.5 0 0 1 0 5h-2" />
              <path d="M8 6c0-1.5 1-1.5 1-3M12 6c0-1.5 1-1.5 1-3" />
            </svg>
          </span>
          <span>Mokuren Tea</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {NAVIGATION.links.map((link) => {
            const isBag = link.id === 'bag'

            return (
              <Link
                key={link.id}
                href={link.href}
                className={isBag ? styles.bagBtn : styles.navLink}
                aria-label={isBag ? link.label : undefined}
                aria-current={pathname === link.href ? 'page' : undefined}
              >
                {isBag ? (
                  <>
                    Bag <span className={styles.bagCount}>{bagCount}</span>
                  </>
                ) : (
                  link.label
                )}
              </Link>
            )
          })}
        </nav>

        <div className={styles.headerActions}>
          {bagLink && (
            <Link
              href={bagLink.href}
              className={styles.bagBtn}
              aria-label={bagLink.label}
              onClick={closeMenu}
            >
              Bag <span className={styles.bagCount}>{bagCount}</span>
            </Link>
          )}
          <button
            type="button"
            ref={menuButtonRef}
            className={styles.hamburger}
            aria-controls={mobilePanelId}
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={toggleMenu}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d={isMenuOpen ? 'M6 6l12 12M6 18 18 6' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </Container>
      <nav
        id={mobilePanelId}
        className={styles.mobilePanel}
        aria-label="Mobile"
        hidden={!isMenuOpen}
      >
        {NAVIGATION.links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            onClick={closeMenu}
            aria-current={pathname === href ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
