'use client'

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AdminAuthError,
  authErrorMessage,
  changeAdminPassword,
  loginAdmin,
} from '@/app/shared/api/requests/admin-auth'

export function useAuthFormHook(mode: 'login' | 'change-password') {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) {
      return
    }
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    const changingPassword = mode === 'change-password'
    setError('')
    if (changingPassword && password !== form.get('confirmPassword')) {
      setError('The new passwords do not match.')
      return
    }

    submitting.current = true
    setIsSubmitting(true)
    try {
      const result = changingPassword
        ? await changeAdminPassword(String(form.get('currentPassword') || ''), password)
        : await loginAdmin(String(form.get('login') || '').trim(), password)
      // A full navigation drops protected data from the previous session's router cache.
      window.location.replace(result.mustChangePassword ? '/change-password' : '/')
    } catch (error) {
      if (error instanceof AdminAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
        window.location.replace('/change-password')
        return
      }
      if (
        error instanceof AdminAuthError &&
        error.status === 401 &&
        error.code !== 'INVALID_CREDENTIALS' &&
        changingPassword
      ) {
        window.location.replace('/login')
        return
      }
      setError(authErrorMessage(error, changingPassword))
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  return { isSubmitting, error, handleSubmit }
}
