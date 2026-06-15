// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Necesario para Docker — genera un build autónomo sin node_modules completo
  output: 'standalone',

  // Permite imágenes desde S3.
  // Usamos wildcard de hostname para no depender de AWS_S3_BUCKET en build-time
  // (la variable llega en runtime desde el ConfigMap, no durante el docker build).
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },

  // Headers de seguridad
  async headers() {
    // En runtime sí existe la variable — úsala para la CSP
    const s3Host = process.env.AWS_S3_BUCKET
      ? `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com`
      : '*.amazonaws.com'
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
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              `img-src 'self' data: blob: https://${s3Host}`,
              "font-src 'self' data: https://fonts.gstatic.com",
              // connect-src debe incluir S3 para el PUT presignado del admin
              `connect-src 'self' https://${s3Host}`,
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
