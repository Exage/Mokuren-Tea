import { redirect } from 'next/navigation'
import { getAdminSession } from '@/app/shared/api/requests/admin-session'
import { AuthForm } from '@/app/shared/components/auth-form'

export async function LoginScreen() {
  const user = await getAdminSession()
  if (user) {
    redirect(user.mustChangePassword ? '/change-password' : '/')
  }
  return <AuthForm mode="login" />
}
