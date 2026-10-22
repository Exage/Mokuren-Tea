import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AdminAuthGuard } from './admin-auth.guard.js'
import { AdminSessionGuard } from './admin-session.guard.js'
import { AdminAuthController } from './auth.controller.js'
import { AdminUsersController } from './admin-users.controller.js'
import { AuthService } from './auth.service.js'
import { AdminUsersService } from './admin-users.service.js'
import { CsrfGuard } from './csrf.guard.js'
import { AdminUser, AdminUserSchema } from './schemas/admin-user.schema.js'
import { AdminSession, AdminSessionSchema } from './schemas/admin-session.schema.js'
import { AdminUserRepository } from './admin-user.repository.js'
import { AdminSessionRepository } from './admin-session.repository.js'
import { RateLimitGuard } from './rate-limit.guard.js'
import { AuditModule } from '../audit/audit.module.js'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: AdminSession.name, schema: AdminSessionSchema },
    ]),
    AuditModule,
  ],
  providers: [
    AdminAuthGuard,
    AdminSessionGuard,
    CsrfGuard,
    RateLimitGuard,
    AuthService,
    AdminUsersService,
    AdminUserRepository,
    AdminSessionRepository,
  ],
  controllers: [AdminAuthController, AdminUsersController],
  exports: [AdminAuthGuard, AdminSessionGuard, CsrfGuard, RateLimitGuard, AuthService],
})
export class AuthModule {}
