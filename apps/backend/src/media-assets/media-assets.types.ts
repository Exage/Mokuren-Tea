export type { MediaAssetView } from './media-asset.mapper.js'

export interface UploadedFileInput {
  buffer: Uint8Array
  originalname: string
  mimetype?: string
  size: number
}

export interface ResolvedImage {
  id: string
  url: string
  alt?: string
  width?: number
  height?: number
}

export interface AssetUsageEntry {
  id: string
  name: string
  slug: string
  status: string
}

export type ImagePreset = 'catalog' | 'detail'

export interface CloudinaryUploadResult {
  assetId: string
  publicId: string
  version: number
  secureUrl: string
  format: string
  bytes: number
  width: number
  height: number
}

export interface CloudinaryResourceInfo {
  assetId: string
  publicId: string
  version: number
  secureUrl: string
  format: string
  bytes: number
  width: number
  height: number
}
