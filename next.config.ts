// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Necesario para Docker — genera un build autónomo sin node_modules completo
  output: 'standalone',
  // Permite imágenes desde S3
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: `${process.env.AWS_S3_BUCKET}.s3.amazonaws.com`,
      },
      {
        protocol: 'https',
        hostname: `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
      },
    ],
  },

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
