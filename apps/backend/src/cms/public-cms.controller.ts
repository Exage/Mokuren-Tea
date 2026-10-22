import { Controller, Get, Param } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { CmsBlockKey } from './cms.types.js'
import { CmsService } from './cms.service.js'
import { PublishedCmsBlockDto, PublishedCmsPageDto } from './dto/cms.dto.js'

interface PublicBlockResult {
  content: Record<string, unknown> | null
  version: number
}

interface PublicPageResult {
  pageKey: string
  blocks: Record<string, PublicBlockResult>
}

@ApiTags('public-cms')
@Controller('public/cms')
export class PublicCmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('pages/:pageKey')
  @ApiOperation({ summary: 'Get published page content' })
  @ApiOkResponse({ type: PublishedCmsPageDto })
  getPage(@Param('pageKey') pageKey: string): Promise<PublicPageResult> {
    return this.cmsService.getPublishedPage(pageKey)
  }

  @Get('pages/:pageKey/blocks/:blockKey')
  @ApiOperation({ summary: 'Get published block content' })
  @ApiOkResponse({ type: PublishedCmsBlockDto })
  getBlock(
    @Param('pageKey') pageKey: string,
    @Param('blockKey') blockKey: string
  ): Promise<PublicBlockResult> {
    return this.cmsService.getPublishedBlock(pageKey, blockKey as CmsBlockKey)
  }
}
