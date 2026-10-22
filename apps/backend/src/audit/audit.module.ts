import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuditService } from './audit.service.js'
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema.js'
import { AdminAuditController } from './admin-audit.controller.js'

@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }])],
  providers: [AuditService],
  controllers: [AdminAuditController],
  exports: [AuditService],
})
export class AuditModule {}
