'use client'

import { AuthFrame } from '@/app/shared/components/auth-frame'

export default function ErrorPage() {
  return (
    <AuthFrame
      title="Unable to load this page"
      description="The server may be unavailable. Please try again in a moment."
    >
      <a href="">Reload page</a>
    </AuthFrame>
  )
}
