import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { PublicTasteNoteListResponse } from './dto/public-taste-note-response.dto.js'
import { TasteNoteManagementService } from './taste-note-management.service.js'

// Public taste-note discovery: no session required. Only taste notes
// referenced by at least one published product are visible.
@ApiTags('taste-notes')
@Controller('taste-notes')
export class TasteNotesController {
  constructor(private readonly tasteNoteManagementService: TasteNoteManagementService) {}

  @Get()
  @ApiOperation({ summary: 'List taste notes visible in the public catalog' })
  @ApiOkResponse({ type: PublicTasteNoteListResponse })
  async list(): Promise<PublicTasteNoteListResponse> {
    const items = await this.tasteNoteManagementService.listPublicTasteNotes()
    return { items }
  }
}
