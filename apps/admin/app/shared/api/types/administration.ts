export interface Administrator {
  id: string
  login: string
  displayName: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface AdministratorCredentials {
  user: Administrator
  temporaryPassword?: string
  temporaryPasswordExpiresAt?: string
}

export interface AuditEntry {
  id: string
  actorId: string | null
  action: string
  entityType: string
  entityId: string | null
  changes: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface AuditQuery {
  page?: number
  actorId?: string
  action?: string
  entityType?: string
  entityId?: string
  from?: string
  to?: string
}
