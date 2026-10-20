import type { AdminRequestUser } from '../auth/auth.types.js'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { CurrentAdmin } from '../auth/current-admin.decorator.js'
import {
  AdminTasteNoteListResponse,
  AdminTasteNoteResponse,
} from './dto/admin-taste-note-response.dto.js'
import { AdminTasteNotesQueryDto } from './dto/admin-taste-notes-query.dto.js'
import { CreateTasteNoteDto } from './dto/create-taste-note.dto.js'
import { UpdateTasteNoteDto } from './dto/update-taste-note.dto.js'
import { TasteNoteUsagesResponse } from './dto/taste-note-usages-response.dto.js'
import { DeleteTasteNoteResponse } from './dto/delete-taste-note-response.dto.js'
import { TasteNotesService } from './taste-notes.service.js'
import { TasteNoteManagementService } from './taste-note-management.service.js'

// Administrative taste-note management. The class-level guard ensures every
// method here is authenticated; the controller only resolves the actor and
// delegates rules, transactions and audit to TasteNoteManagementService and
// TasteNotesService.
@ApiTags('admin-taste-notes')
@UseGuards(AdminAuthGuard)
@Controller('admin/taste-notes')
export class AdminTasteNotesController {
  constructor(
    private readonly tasteNotesService: TasteNotesService,
    private readonly tasteNoteManagementService: TasteNoteManagementService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List taste notes for administrators' })
  @ApiOkResponse({ type: AdminTasteNoteListResponse })
  list(@Query() query: AdminTasteNotesQueryDto) {
    return this.tasteNoteManagementService.listAdminTasteNotes(query)
  }

  @Post()
  @ApiOperation({ summary: 'Create a taste note' })
  @ApiCreatedResponse({ type: AdminTasteNoteResponse })
  create(
    @Body() dto: CreateTasteNoteDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminTasteNoteResponse> {
    return this.tasteNotesService.create(dto, admin?.adminId || null)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a taste note' })
  @ApiOkResponse({ type: AdminTasteNoteResponse })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTasteNoteDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<AdminTasteNoteResponse> {
    const productsCount = await this.tasteNoteManagementService.countProductsForTasteNote(id)
    return this.tasteNotesService.update(id, dto, admin?.adminId || null, productsCount)
  }

  @Get(':id/usages')
  @ApiOperation({ summary: 'Count products referencing a taste note before deletion' })
  @ApiOkResponse({ type: TasteNoteUsagesResponse })
  async usages(@Param('id') id: string): Promise<TasteNoteUsagesResponse> {
    const productsCount = await this.tasteNoteManagementService.countProductsForTasteNote(id)
    return { productsCount }
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a taste note and remove it from all products' })
  @ApiOkResponse({ type: DeleteTasteNoteResponse })
  delete(
    @Param('id') id: string,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<DeleteTasteNoteResponse> {
    return this.tasteNoteManagementService.deleteTasteNote(id, admin?.adminId || null)
  }
}
