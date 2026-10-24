'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useWindowSizeHook } from '@/app/shared/hooks'

export function useHeaderHook() {
  const pathname = usePathname()
  const { width } = useWindowSizeHook()
  const isDesktop = Boolean(width && width > 1024)
  const mobilePanelId = useId()
  const headerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const [openMenuPathname, setOpenMenuPathname] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const isMenuOpen = openMenuPathname === pathname && !isDesktop

  const closeMenu = () => setOpenMenuPathname(null)
  const toggleMenu = () => {
    setOpenMenuPathname((previous) => (previous === pathname ? null : pathname))
  }

  useEffect(() => {
    const updateScroll = () => {
      setIsScrolled(window.scrollY > 60)
    }
    const frame = window.requestAnimationFrame(updateScroll)
    window.addEventListener('scroll', updateScroll, { passive: true })

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateScroll)
    }
  }, [])

  useEffect(() => {
    if (!isDesktop) {
      return
    }

    const frame = window.requestAnimationFrame(() => setOpenMenuPathname(null))

    return () => window.cancelAnimationFrame(frame)
  }, [isDesktop])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const root = document.documentElement
    const body = document.body
    const previousRootOverflow = root.style.overflow
    const previousBodyOverflow = body.style.overflow
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpenMenuPathname(null)
        menuButtonRef.current?.focus()
      }

      if (event.key === 'Tab') {
        const elements = Array.from(
          headerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') || []
        ).filter((element) => element.getClientRects().length > 0)
        const first = elements[0]
        const last = elements[elements.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      root.style.overflow = previousRootOverflow
      body.style.overflow = previousBodyOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  return {
    pathname,
    mobilePanelId,
    headerRef,
    menuButtonRef,
    isMenuOpen,
    isScrolled,
    closeMenu,
    toggleMenu,
  }
}
