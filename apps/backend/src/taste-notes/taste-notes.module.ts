import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuditModule } from '../audit/audit.module.js'
import { TasteNotesRepository } from './taste-notes.repository.js'
import { TasteNotesService } from './taste-notes.service.js'
import { TasteNote, TasteNoteSchema } from './schemas/taste-note.schema.js'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TasteNote.name, schema: TasteNoteSchema }]),
    AuditModule,
  ],
  providers: [TasteNotesRepository, TasteNotesService],
  exports: [TasteNotesService],
})
export class TasteNotesModule {}
