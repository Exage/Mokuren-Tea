import type { CloudinaryUploadResult, CloudinaryResourceInfo } from './media-assets.types.js'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v2 as cloudinary } from 'cloudinary'

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as Record<string, unknown>

  if (record.http_code === 404) {
    return true
  }

  const inner = record.error as Record<string, unknown> | undefined

  if (typeof inner?.http_code === 'number' && inner.http_code === 404) {
    return true
  }

  const message = typeof record.message === 'string' ? record.message : ''

  if (/not\s*found/i.test(message)) {
    return true
  }

  return false
}

// The only place in the codebase that calls the Cloudinary SDK. Credentials
// are read server-side and never leave this service in API responses or logs.
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name)
  private readonly assetFolder: string | undefined
  private readonly configured: boolean

  constructor(private readonly config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME')
    const apiKey = config.get<string>('CLOUDINARY_API_KEY')
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET')

    this.assetFolder = config.get<string>('CLOUDINARY_ASSET_FOLDER')

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
      this.configured = true
    } else {
      this.configured = false
    }
  }

  isConfigured(): boolean {
    return this.configured
  }

  // Unique public_id generated separately from the folder, tied to the
  // internal asset id. The environment prefix keeps development and
  // production uploads distinct even when both share the same Cloudinary
  // folder. overwrite:false guarantees existing files are not replaced.
  buildPublicId(assetId: string): string {
    const environment =
      this.config.get<string>('NODE_ENV') === 'production' ? 'production' : 'development'
    return `mokuren-tea-${environment}-${assetId}`
  }

  async uploadImage(buffer: Uint8Array, publicId: string): Promise<CloudinaryUploadResult> {
    const uploaded = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'image',
          overwrite: false,
          unique_filename: false,
          transformation: [{ width: 558, crop: 'scale' }],
          // Dynamic folders: place the asset into the existing Cloudinary
          // folder instead of encoding the path into public_id.
          ...(this.assetFolder ? { asset_folder: this.assetFolder } : {}),
        },
        (error: unknown, result: unknown) => {
          if (error) {
            reject(error)
            return
          }

          resolve(result as Record<string, unknown>)
        }
      )
      stream.end(Buffer.from(buffer))
    })

    const secureUrl = uploaded.secure_url

    if (typeof secureUrl !== 'string' || secureUrl.length === 0) {
      throw new Error('Cloudinary upload returned no secure_url')
    }

    return {
      assetId: typeof uploaded.asset_id === 'string' ? uploaded.asset_id : '',
      publicId: typeof uploaded.public_id === 'string' ? uploaded.public_id : publicId,
      version: typeof uploaded.version === 'number' ? uploaded.version : 0,
      secureUrl,
      format: typeof uploaded.format === 'string' ? uploaded.format : '',
      bytes: typeof uploaded.bytes === 'number' ? uploaded.bytes : buffer.length,
      width: typeof uploaded.width === 'number' ? uploaded.width : 0,
      height: typeof uploaded.height === 'number' ? uploaded.height : 0,
    }
  }

  // Dynamic folder mode stores the folder in the asset's public ID, so a
  // public_id saved before upload (no folder) may need the folder prefix to
  // resolve. Candidates are tried in order, most specific first.
  private publicIdCandidates(publicId: string): string[] {
    const candidates = [publicId]

    if (this.assetFolder && !publicId.startsWith(`${this.assetFolder}/`)) {
      candidates.push(`${this.assetFolder}/${publicId}`)
    }

    return candidates
  }

  // Missing resources count as successful deletion so retries after a
  // partially completed cleanup stay idempotent.
  async destroyImage(publicId: string): Promise<void> {
    let lastError: unknown

    for (const candidate of this.publicIdCandidates(publicId)) {
      try {
        const result = (await cloudinary.uploader.destroy(candidate, {
          resource_type: 'image',
          invalidate: true,
        })) as Record<string, unknown>

        if (result?.result === 'not found') {
          continue
        }

        return
      } catch (error) {
        if (isNotFoundError(error)) {
          continue
        }

        lastError = error
      }
    }

    if (lastError) {
      throw lastError
    }

    this.logger.warn(`Cloudinary resource already missing: ${publicId}`)
  }

  async fetchResource(publicId: string): Promise<CloudinaryResourceInfo | null> {
    for (const candidate of this.publicIdCandidates(publicId)) {
      try {
        const resource = (await cloudinary.api.resource(candidate, {
          resource_type: 'image',
        })) as Record<string, unknown>
        const secureUrl = resource.secure_url

        if (typeof secureUrl !== 'string' || secureUrl.length === 0) {
          continue
        }

        return {
          assetId: typeof resource.asset_id === 'string' ? resource.asset_id : '',
          publicId: typeof resource.public_id === 'string' ? resource.public_id : candidate,
          version: typeof resource.version === 'number' ? resource.version : 0,
          secureUrl,
          format: typeof resource.format === 'string' ? resource.format : '',
          bytes: typeof resource.bytes === 'number' ? resource.bytes : 0,
          width: typeof resource.width === 'number' ? resource.width : 0,
          height: typeof resource.height === 'number' ? resource.height : 0,
        }
      } catch (error) {
        if (isNotFoundError(error)) {
          continue
        }

        throw error
      }
    }

    return null
  }
}
