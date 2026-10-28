import type { AdminAuthResponse } from '../types/admin-auth'

const authPath = '/api/admin/auth'

export class AdminAuthError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AdminAuthError'
    this.status = status
    this.code = code
  }
}

export async function checkResponse(response: Response): Promise<void> {
  if (response.ok) {
    return
  }

  const body = await response.json().catch(() => null)
  const message =
    typeof body?.message === 'string'
      ? body.message
      : Array.isArray(body?.message)
        ? body.message.join(' ')
        : 'The request could not be completed.'
  const details = Array.isArray(body?.details)
    ? body.details
        .map((detail: { message?: string }) => detail?.message)
        .filter(Boolean)
        .join(' ')
    : ''
  throw new AdminAuthError(
    response.status,
    body?.code || 'REQUEST_FAILED',
    [message, details].filter(Boolean).join(' ')
  )
}

function csrfCookie(): string {
  const name = process.env.NEXT_PUBLIC_CSRF_TOKEN_NAME || 'csrf_token'
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : ''
}

export async function csrfToken(refresh = false): Promise<string> {
  if (!refresh && csrfCookie()) {
    return csrfCookie()
  }

  const response = await fetch(`${authPath}/csrf-token`, {
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  await checkResponse(response)
  // This endpoint returns 204; the token is carried only in the readable cookie.
  const token = csrfCookie()
  if (!token) {
    throw new AdminAuthError(403, 'CSRF_REQUIRED', 'Security cookie is unavailable.')
  }
  return token
}

async function authMutation(path: string, body?: object): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await csrfToken(attempt > 0)
    const response = await fetch(`${authPath}/${path}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    })
    try {
      await checkResponse(response)
      return response
    } catch (error) {
      // Only a rejected CSRF check is safe to retry automatically.
      if (!(error instanceof AdminAuthError) || error.code !== 'CSRF_REQUIRED' || attempt > 0) {
        throw error
      }
    }
  }
  throw new AdminAuthError(403, 'CSRF_REQUIRED', 'Security check failed.')
}

export async function loginAdmin(login: string, password: string): Promise<AdminAuthResponse> {
  const response = await authMutation('login', { login, password })
  return response.json()
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<AdminAuthResponse> {
  const response = await authMutation('change-password', { currentPassword, newPassword })
  return response.json()
}

export async function logoutAdmin(): Promise<void> {
  await authMutation('logout')
}

export function authErrorMessage(error: unknown, changingPassword = false): string {
  if (!(error instanceof AdminAuthError)) {
    return 'Unable to reach the server. Please try again.'
  }
  if (error.code === 'INVALID_CREDENTIALS') {
    return changingPassword ? 'The current password is incorrect.' : 'Invalid login or password.'
  }
  if (error.code === 'CSRF_REQUIRED') {
    return 'Security check failed. Please refresh the page and try again.'
  }
  if (error.status === 429) {
    return 'Too many attempts. Please wait and try again.'
  }
  if (error.status === 400 && error.code === 'VALIDATION_ERROR') {
    return error.message
  }
  if (error.status === 401) {
    return 'Your session has expired. Please sign in again.'
  }
  return 'The request could not be completed. Please try again.'
}
