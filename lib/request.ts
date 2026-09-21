// Viewer IP behind CloudFront ("ip:port", IPv6 without brackets); x-forwarded-for as a local fallback.
export function clientIp(headers: Headers): string | null {
  const viewer = headers.get('cloudfront-viewer-address')
  if (viewer) return viewer.slice(0, viewer.lastIndexOf(':'))
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || null
}
