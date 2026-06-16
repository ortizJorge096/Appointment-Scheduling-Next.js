// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Necesario para Docker — genera un build autónomo sin node_modules completo
  output: 'standalone',

  // Don't expose the framework in response headers
  poweredByHeader: false,

  // React best practices (flags unsafe effects/patterns in dev)
  reactStrictMode: true,

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
          // Force HTTPS (served with Let's Encrypt TLS). 2 years.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Disable browser APIs the app doesn't use
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
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
              "object-src 'none'",
              "frame-ancestors 'none'",
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
