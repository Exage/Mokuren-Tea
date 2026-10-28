import { AdminAuthError, checkResponse, csrfToken } from './admin-auth'

// Shared cookie/CSRF transport for the catalog endpoints. Endpoint contracts stay
// in their feature request files; only rejected CSRF checks may be retried.
export async function catalogRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const mutation = !!options.method && options.method !== 'GET'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = new Headers(options.headers)
    if (mutation) {
      headers.set('X-CSRF-Token', await csrfToken(attempt > 0))
      if (options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json')
      }
    }
    const response = await fetch(`/api/admin/${path}`, {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    })
    try {
      await checkResponse(response)
      return (await response.json()) as T
    } catch (error) {
      if (error instanceof AdminAuthError) {
        if (error.status === 401 || error.code === 'PASSWORD_CHANGE_REQUIRED') {
          window.location.replace(error.status === 401 ? '/login' : '/change-password')
        }
        if (mutation && error.code === 'CSRF_REQUIRED' && attempt === 0) {
          continue
        }
      }
      throw error
    }
  }
  throw new Error('Security check failed. Refresh the page and try again.')
}

export function catalogError(error: unknown): string {
  if (error instanceof AdminAuthError) {
    return error.message
  }
  return 'Unable to reach the server. Refresh the list before retrying a change that may have been saved.'
}
