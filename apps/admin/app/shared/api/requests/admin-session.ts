import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminApiUrl } from '../config'
import type { AdminUser } from '../types/admin-auth'

export const getAdminSession = cache(async (): Promise<AdminUser | null> => {
  const cookieStore = await cookies()
  const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'admin_session'
  const sessionCookie = cookieStore.get(sessionCookieName)
  if (!sessionCookie?.value) {
    return null
  }

  const response = await fetch(`${adminApiUrl}/admin/auth/me`, {
    headers: { Cookie: `${sessionCookieName}=${sessionCookie.value}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  })
  if (response.status === 401) {
    return null
  }
  if (!response.ok) {
    throw new Error('Unable to verify the administrator session.')
  }
  return response.json()
})

export async function requireAdminSession(): Promise<AdminUser> {
  const user = await getAdminSession()
  if (!user) {
    redirect('/login')
  }
  if (user.mustChangePassword) {
    redirect('/change-password')
  }
  return user
}
