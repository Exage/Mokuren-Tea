'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminAuthError, authErrorMessage, logoutAdmin } from '@/app/shared/api/requests/admin-auth'

export function useSessionControlsHook() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)

  useEffect(() => {
    function refreshSession() {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }
    window.addEventListener('focus', refreshSession)
    window.addEventListener('pageshow', refreshSession)
    document.addEventListener('visibilitychange', refreshSession)
    return () => {
      window.removeEventListener('focus', refreshSession)
      window.removeEventListener('pageshow', refreshSession)
      document.removeEventListener('visibilitychange', refreshSession)
    }
  }, [router])

  async function handleLogout() {
    if (submitting.current) {
      return
    }
    submitting.current = true
    setIsSubmitting(true)
    setError('')
    try {
      await logoutAdmin()
      window.location.replace('/login')
    } catch (error) {
      if (error instanceof AdminAuthError && error.status === 401) {
        window.location.replace('/login')
        return
      }
      setError(authErrorMessage(error))
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  return { isSubmitting, error, handleLogout }
}
