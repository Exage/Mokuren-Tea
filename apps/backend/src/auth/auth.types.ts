export interface AdminRequestUser {
  adminId: string
  mustChangePassword: boolean
  token?: string
  tokenHash?: string
}
