import { parseCorsOrigins } from './cors.js'

export function validateEnvironment(config: Record<string, unknown>) {
  const nodeEnv = config.NODE_ENV ?? 'development'
  const port = Number(config.PORT ?? 3001)
  const mongoUri = config.MONGODB_URI
  const cloudName = config.CLOUDINARY_CLOUD_NAME
  const apiKey = config.CLOUDINARY_API_KEY
  const apiSecret = config.CLOUDINARY_API_SECRET
  const assetFolder = config.CLOUDINARY_ASSET_FOLDER
  parseCorsOrigins(config.CORS_ORIGINS)

  if (!['development', 'test', 'production'].includes(String(nodeEnv))) {
    throw new Error('NODE_ENV must be development, test, or production')
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  if (typeof mongoUri !== 'string' || !/^mongodb(?:\+srv)?:\/\/\S+$/.test(mongoUri)) {
    throw new Error('MONGODB_URI must be a MongoDB connection string')
  }

  // Cloudinary credentials are required in production where uploads and
  // deletions run against the real provider. In development and test they
  // stay optional so the API can boot without secrets and tests can inject
  // a fake uploader. Provided values must still be non-empty strings.
  const cloudinaryProvided =
    cloudName !== undefined || apiKey !== undefined || apiSecret !== undefined

  if (String(nodeEnv) === 'production' || cloudinaryProvided) {
    if (typeof cloudName !== 'string' || cloudName.trim().length === 0) {
      throw new Error('CLOUDINARY_CLOUD_NAME must be a non-empty string')
    }

    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('CLOUDINARY_API_KEY must be a non-empty string')
    }

    if (typeof apiSecret !== 'string' || apiSecret.trim().length === 0) {
      throw new Error('CLOUDINARY_API_SECRET must be a non-empty string')
    }

    // Existing Cloudinary folder where uploads are placed via Dynamic folders
    // (asset_folder). Required whenever Cloudinary is configured so images
    // never land in the account root.
    if (typeof assetFolder !== 'string' || assetFolder.trim().length === 0) {
      throw new Error('CLOUDINARY_ASSET_FOLDER must be a non-empty string')
    }
  }

  // Authentication settings are optional with sensible defaults, but when
  // provided they must be well-formed so operators cannot silently degrade
  // session or cookie security.
  const cookieSameSite = config.SESSION_COOKIE_SAME_SITE
  if (cookieSameSite !== undefined && !['lax', 'strict', 'none'].includes(String(cookieSameSite))) {
    throw new Error('SESSION_COOKIE_SAME_SITE must be lax, strict, or none')
  }

  const sessionTtlDays = config.SESSION_TTL_DAYS
  if (sessionTtlDays !== undefined) {
    const parsed = Number(sessionTtlDays)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('SESSION_TTL_DAYS must be a positive integer')
    }
  }

  const rateLimitMax = config.RATE_LIMIT_MAX
  if (rateLimitMax !== undefined) {
    const parsed = Number(rateLimitMax)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('RATE_LIMIT_MAX must be a positive integer')
    }
  }

  const rateLimitWindow = config.RATE_LIMIT_WINDOW_MS
  if (rateLimitWindow !== undefined) {
    const parsed = Number(rateLimitWindow)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('RATE_LIMIT_WINDOW_MS must be a positive integer')
    }
  }

  const tempPasswordTtl = config.TEMPORARY_PASSWORD_TTL_HOURS
  if (tempPasswordTtl !== undefined) {
    const parsed = Number(tempPasswordTtl)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('TEMPORARY_PASSWORD_TTL_HOURS must be a positive integer')
    }
  }

  return { ...config, NODE_ENV: nodeEnv, PORT: port, MONGODB_URI: mongoUri }
}
