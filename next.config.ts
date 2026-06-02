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
    const s3Host = process.env.AWS_S3_BUCKET
      ? `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com`
      : ''
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://${s3Host}`,
              "font-src 'self' data:",
              "connect-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
