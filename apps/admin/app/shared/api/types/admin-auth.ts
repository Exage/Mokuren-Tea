export type AdminUser = {
  id: string
  login: string
  displayName: string
  mustChangePassword: boolean
}

export type AdminAuthResponse = {
  user: AdminUser
  mustChangePassword: boolean
}
