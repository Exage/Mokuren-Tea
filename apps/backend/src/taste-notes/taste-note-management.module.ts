import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { AuditModule } from '../audit/audit.module.js'
import { TasteNotesModule } from './taste-notes.module.js'
import { ProductsModule } from '../products/products.module.js'
import { AdminTasteNotesController } from './admin-taste-notes.controller.js'
import { TasteNotesController } from './taste-notes.controller.js'
import { TasteNoteManagementService } from './taste-note-management.service.js'

// Coordinates taste-note use cases and registers both taste-note controllers.
// Imports both feature modules; TasteNotesModule stays independent of
// ProductsModule so the dependency graph remains acyclic.
@Module({
  imports: [TasteNotesModule, ProductsModule, AuthModule, AuditModule],
  controllers: [AdminTasteNotesController, TasteNotesController],
  providers: [TasteNoteManagementService],
  exports: [TasteNoteManagementService],
})
export class TasteNoteManagementModule {}
