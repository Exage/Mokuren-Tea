import { redirect } from 'next/navigation'
import { getAdminSession } from '@/app/shared/api/requests/admin-session'
import { AuthForm } from '@/app/shared/components/auth-form'

export async function ChangePasswordScreen() {
  const user = await getAdminSession()
  if (!user) {
    redirect('/login')
  }
  return <AuthForm mode="change-password" user={user} />
}
