import type { NextConfig } from 'next'

const site = process.env.NEXT_PUBLIC_SITE_URL

const nextConfig: NextConfig = {
  // standalone: self-contained server bundle for the EC2 (node .next/standalone/server.js).
  output: 'standalone',
  // The app is reached through Cloudflare Pages → CloudFront → Caddy, so the Host Next sees is not the
  // public one. Server Actions reject that as CSRF unless the public origin is allowed explicitly.
  experimental: { serverActions: { allowedOrigins: site ? [new URL(site).host] : [] } },
}

export default nextConfig
