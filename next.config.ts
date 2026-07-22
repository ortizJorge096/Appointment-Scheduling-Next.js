// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for Docker — produces a standalone build without full node_modules
  output: 'standalone',

  // Don't expose the framework in response headers
  poweredByHeader: false,

  // React best practices (flags unsafe effects/patterns in dev)
  reactStrictMode: true,

  // Allows images from S3.
  // We use hostname wildcard to avoid depending on AWS_S3_BUCKET at build-time
  // (the variable arrives at runtime from ConfigMap, not during docker build).
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
    // Cache each OPTIMIZED variant for a year instead of Next's 60s default. The
    // hero/gallery S3 keys are immutable (a changed image = a new key = a new URL),
    // so a long TTL never serves a stale image. Without this, `Cache-Control` was
    // `max-age=60, must-revalidate` → every ~minute the first visitor re-triggered
    // optimization of every image on the pod (measured TTFBs of 1–4s). Now the pod
    // (and the browser) reuse the variant → cache HIT, TTFB ~0.
    minimumCacheTTL: 31536000, // 1 year
  },

  // Security headers
  async headers() {
    // At runtime the variable exists — use it for CSP
    const s3Host = process.env.AWS_S3_BUCKET
      ? `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com`
      : '*.amazonaws.com'
    // Next.js dev (Fast Refresh / source maps) needs eval; production does not.
    // Only relax script-src in development — prod stays strict.
    const isDev = process.env.NODE_ENV !== 'production'
    // Google Analytics 4 loads gtag.js from googletagmanager and may pull the
    // measurement library from google-analytics. Cloudflare injects its cookieless
    // RUM beacon (static.cloudflareinsights.com) at the edge — the CF proxy already
    // terminates our TLS and serves the HTML, so it's inside the trust boundary
    // already; allowing its beacon buys real Core Web Vitals from visitors.
    const scriptSrc = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com`
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
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // GA4 may fire pixel/beacon requests as images.
              `img-src 'self' data: blob: https://${s3Host} https://www.google-analytics.com https://stats.g.doubleclick.net`,
              "font-src 'self' data: https://fonts.gstatic.com",
              // connect-src must include S3 for the admin's presigned PUT, the GA4
              // collect endpoints (incl. regionalized *.google-analytics.com), and
              // the Cloudflare RUM beacon target (it POSTs to cloudflareinsights.com
              // /cdn-cgi/rum — the apex, not the static.* host that serves the script).
              `connect-src 'self' https://${s3Host} https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://cloudflareinsights.com`,
              "object-src 'none'",
              "frame-ancestors 'none'",
              // Allow the embedded Google Maps iframe in the "Visítanos" section
              "frame-src https://www.google.com https://maps.google.com",
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
