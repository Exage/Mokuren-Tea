import type { AdminRequestUser } from '../auth/auth.types.js'
import type { CmsBlockKey } from './cms.types.js'
import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { CsrfGuard } from '../auth/csrf.guard.js'
import { CurrentAdmin } from '../auth/current-admin.decorator.js'
import { ApiAdminErrors } from '../config/api-error-responses.decorator.js'
import { CmsService } from './cms.service.js'
import {
  SaveCmsDraftDto,
  PublishCmsBlockDto,
  RestoreCmsRevisionDto,
  CmsBlockDto,
  CmsRevisionListDto,
  CmsPagePreviewDto,
  CmsBlockListDto,
} from './dto/cms.dto.js'

@ApiTags('admin-cms')
@ApiAdminErrors()
@ApiBearerAuth()
@ApiCookieAuth('admin_session')
@Controller('admin/cms')
export class AdminCmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('blocks')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'List CMS blocks (admin, draft + published)' })
  @ApiOkResponse({ type: CmsBlockListDto })
  listBlocks(): Promise<{
    items: CmsBlockDto[]
    pagination: { page: number; limit: number; totalItems: number; totalPages: number }
  }> {
    return this.cmsService.listBlocksAdmin()
  }

  @Get('blocks/:pageKey/:blockKey')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get a CMS block (admin, draft + published)' })
  @ApiOkResponse({ type: CmsBlockDto })
  getBlock(
    @Param('pageKey') pageKey: string,
    @Param('blockKey') blockKey: string
  ): Promise<CmsBlockDto> {
    return this.cmsService.getBlockAdmin(pageKey, blockKey as CmsBlockKey)
  }

  @Patch('blocks/:pageKey/:blockKey/draft')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Save a CMS draft with optimistic version check' })
  @ApiOkResponse({ type: CmsBlockDto })
  saveDraft(
    @Param('pageKey') pageKey: string,
    @Param('blockKey') blockKey: string,
    @Body() dto: SaveCmsDraftDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<CmsBlockDto> {
    if (dto.pageKey !== pageKey || dto.blockKey !== blockKey) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Body block key must match the route',
      })
    }
    return this.cmsService.saveDraft({
      pageKey,
      blockKey: blockKey as CmsBlockKey,
      content: dto.content,
      expectedDraftVersion: dto.expectedDraftVersion,
      actorId: admin?.adminId ?? null,
    })
  }

  @Post('blocks/:pageKey/:blockKey/publish')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Publish one CMS block (atomic)' })
  @ApiOkResponse({ type: CmsBlockDto })
  publishBlock(
    @Param('pageKey') pageKey: string,
    @Param('blockKey') blockKey: string,
    @Body() dto: PublishCmsBlockDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<CmsBlockDto> {
    if (dto.pageKey !== pageKey || dto.blockKey !== blockKey) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Body block key must match the route',
      })
    }
    return this.cmsService.publishBlock({
      pageKey,
      blockKey: blockKey as CmsBlockKey,
      actorId: admin?.adminId ?? null,
    })
  }

  @Get('blocks/:pageKey/:blockKey/revisions')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'List published revisions for a CMS block' })
  @ApiOkResponse({ type: CmsRevisionListDto })
  listRevisions(
    @Param('pageKey') pageKey: string,
    @Param('blockKey') blockKey: string
  ): Promise<CmsRevisionListDto> {
    return this.cmsService.listRevisions(pageKey, blockKey as CmsBlockKey, 1, 50)
  }

  @Post('blocks/:pageKey/:blockKey/revisions/:revisionId/restore')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Restore a revision to the draft (published untouched)' })
  @ApiOkResponse({ type: CmsBlockDto })
  restoreRevision(
    @Param('pageKey') pageKey: string,
    @Param('blockKey') blockKey: string,
    @Param('revisionId') revisionId: string,
    @Body() dto: RestoreCmsRevisionDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<CmsBlockDto> {
    if (dto.pageKey !== pageKey || dto.blockKey !== blockKey || dto.revisionId !== revisionId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Body revision must match the route',
      })
    }
    return this.cmsService.restoreRevision({
      pageKey,
      blockKey: blockKey as CmsBlockKey,
      revisionId: dto.revisionId,
      actorId: admin?.adminId ?? null,
    })
  }

  @Get('preview/:pageKey/:blockKey')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Preview a page: draft of one block + published others' })
  @ApiOkResponse({ type: CmsPagePreviewDto })
  previewPage(
    @Param('pageKey') pageKey: string,
    @Param('blockKey') blockKey: string
  ): Promise<CmsPagePreviewDto> {
    return this.cmsService.previewPage(pageKey, blockKey as CmsBlockKey)
  }
}
