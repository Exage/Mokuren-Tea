export const adminApiUrl = (process.env.ADMIN_API_URL || 'http://127.0.0.1:3001/api').replace(
  /\/$/,
  ''
)
