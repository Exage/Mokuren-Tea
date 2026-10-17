export function validateEnvironment(config: Record<string, unknown>) {
  const nodeEnv = config.NODE_ENV ?? 'development'
  const port = Number(config.PORT ?? 3001)
  const mongoUri = config.MONGODB_URI
  const cloudName = config.CLOUDINARY_CLOUD_NAME
  const apiKey = config.CLOUDINARY_API_KEY
  const apiSecret = config.CLOUDINARY_API_SECRET
  const assetFolder = config.CLOUDINARY_ASSET_FOLDER

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

  return { ...config, NODE_ENV: nodeEnv, PORT: port, MONGODB_URI: mongoUri }
}
