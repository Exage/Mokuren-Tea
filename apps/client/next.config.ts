import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@mokuren/ui'],
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }] },
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
