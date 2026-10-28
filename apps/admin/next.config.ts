import type { NextConfig } from 'next'
import { adminApiUrl } from './app/shared/api/config'

const nextConfig: NextConfig = {
  transpilePackages: ['@mokuren/ui'],
  async rewrites() {
    return [{ source: '/api/admin/:path*', destination: `${adminApiUrl}/admin/:path*` }]
  },
}

export default nextConfig
