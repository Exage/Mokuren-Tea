import type { UploadedFileInput } from './media-assets.types.js'
import type { AdminRequestUser } from '../auth/auth.types.js'
import {
  Body,
  Controller,
  Delete,
  ExceptionFilter,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
  ArgumentsHost,
  BadRequestException,
  Catch,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger'
import { CurrentAdmin } from '../auth/current-admin.decorator.js'
import { AdminAuthGuard } from '../auth/admin-auth.guard.js'
import { MAX_UPLOAD_BYTES, MediaAssetsService } from './media-assets.service.js'
import { MediaAssetsQueryDto } from './dto/media-assets-query.dto.js'
import {
  MediaAssetListResponse,
  MediaAssetResponse,
  MediaAssetUsageResponse,
} from './dto/media-asset-response.dto.js'
import { UpdateMediaAssetDto } from './dto/update-media-asset.dto.js'

// Maps Multer limit errors to the project error shape with 413 instead of
// the default 400, keeping oversized uploads distinguishable.
@Catch()
class MediaUploadErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse() as {
      status: (code: number) => { json: (body: unknown) => void }
    }

    if (
      exception instanceof Error &&
      (exception as { code?: unknown }).code === 'LIMIT_FILE_SIZE'
    ) {
      const mapped = new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: `File must not exceed ${MAX_UPLOAD_BYTES} bytes`,
      })
      const body = mapped.getResponse()

      response.status(mapped.getStatus()).json(body)
      return
    }

    if (exception instanceof Error && /file too large/i.test(exception.message)) {
      const mapped = new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: `File must not exceed ${MAX_UPLOAD_BYTES} bytes`,
      })

      response.status(mapped.getStatus()).json(mapped.getResponse())
      return
    }

    throw exception
  }
}

interface MulterFile {
  buffer: Uint8Array
  originalname: string
  mimetype: string
  size: number
}

// Administrative media library. Upload accepts exactly one file via multipart/form-data.
@ApiTags('admin-media-assets')
@Controller('admin/media-assets')
@UseGuards(AdminAuthGuard)
@UseFilters(MediaUploadErrorFilter)
export class AdminMediaAssetsController {
  constructor(private readonly mediaAssetsService: MediaAssetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload an image to the media library' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string', maxLength: 255 },
        alt: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({ type: MediaAssetResponse })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
    })
  )
  async upload(
    @UploadedFile() file: MulterFile | undefined,
    @Body('alt') rawAlt?: unknown,
    @Body('name') rawName?: unknown,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<MediaAssetResponse> {
    const alt = typeof rawAlt === 'string' ? rawAlt : undefined

    if (
      rawName !== undefined &&
      (typeof rawName !== 'string' || rawName.trim().length === 0 || rawName.length > 255)
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'name must be a non-empty string of at most 255 characters',
      })
    }

    if (alt && alt.length > 500) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'alt must not exceed 500 characters',
      })
    }

    const input: UploadedFileInput | undefined = file
      ? {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        }
      : undefined

    return this.mediaAssetsService.uploadImageFile(
      input,
      alt,
      admin?.adminId,
      rawName as string | undefined
    )
  }

  @Get()
  @ApiOperation({ summary: 'List media assets with pagination' })
  @ApiOkResponse({ type: MediaAssetListResponse })
  list(@Query() query: MediaAssetsQueryDto): Promise<MediaAssetListResponse> {
    return this.mediaAssetsService.list(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a media asset' })
  @ApiOkResponse({ type: MediaAssetResponse })
  getById(@Param('id') id: string): Promise<MediaAssetResponse> {
    return this.mediaAssetsService.getById(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update media asset name or alt text' })
  @ApiOkResponse({ type: MediaAssetResponse })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMediaAssetDto,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<MediaAssetResponse> {
    return this.mediaAssetsService.update(id, dto, admin?.adminId)
  }

  @Get(':id/usages')
  @ApiOperation({ summary: 'List products using an image' })
  @ApiOkResponse({ type: [MediaAssetUsageResponse] })
  usages(@Param('id') id: string): Promise<MediaAssetUsageResponse[]> {
    return this.mediaAssetsService.getUsages(id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start deletion of an unused image' })
  @ApiOkResponse({ type: MediaAssetResponse })
  async remove(
    @Param('id') id: string,
    @CurrentAdmin() admin?: AdminRequestUser
  ): Promise<MediaAssetResponse> {
    const { view } = await this.mediaAssetsService.beginDelete(id, admin?.adminId)
    return view
  }
}
