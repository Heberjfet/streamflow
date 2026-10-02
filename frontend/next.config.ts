import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    const apiDestination = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/?$/, '')}/v1/:path*`
      : 'http://api:3001/v1/:path*'

    if (!apiDestination.startsWith('http://') && !apiDestination.startsWith('https://')) {
      return []
    }

    return [
      {
        source: '/api/:path*',
        destination: apiDestination,
      },
    ]
  },
}

export default nextConfig
