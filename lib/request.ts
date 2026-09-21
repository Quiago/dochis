import { timingSafeEqual } from 'node:crypto'

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

// Visitor IP. Behind the Cloudflare Pages proxy, trust its x-client-ip only when it proves itself with PROXY_SECRET;
// otherwise CloudFront's viewer address ("ip:port", IPv6 without brackets); x-forwarded-for as a local fallback.
export function clientIp(headers: Headers): string | null {
  const secret = process.env.PROXY_SECRET
  const proxied = headers.get('x-client-ip')
  if (secret && proxied && sameSecret(headers.get('x-proxy-secret') ?? '', secret)) return proxied
  const viewer = headers.get('cloudfront-viewer-address')
  if (viewer) return viewer.slice(0, viewer.lastIndexOf(':'))
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || null
}
