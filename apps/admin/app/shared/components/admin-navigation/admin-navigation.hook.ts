import { usePathname } from 'next/navigation'

export function useAdminNavigationHook() {
  const pathname = usePathname()

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
  }

  return { isActive }
}
