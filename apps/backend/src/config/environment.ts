export function validateEnvironment(config: Record<string, unknown>) {
  const nodeEnv = config.NODE_ENV ?? 'development'
  const port = Number(config.PORT ?? 3001)
  const mongoUri = config.MONGODB_URI

  if (!['development', 'test', 'production'].includes(String(nodeEnv))) {
    throw new Error('NODE_ENV must be development, test, or production')
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  if (typeof mongoUri !== 'string' || !/^mongodb(?:\+srv)?:\/\/\S+$/.test(mongoUri)) {
    throw new Error('MONGODB_URI must be a MongoDB connection string')
  }

  return { ...config, NODE_ENV: nodeEnv, PORT: port, MONGODB_URI: mongoUri }
}
