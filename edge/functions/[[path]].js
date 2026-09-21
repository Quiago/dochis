// Cloudflare Pages Function: serves the app at https://<project>.pages.dev by proxying every request to CloudFront.
// Env: ORIGIN (CloudFront URL) and PROXY_SECRET (secret, also set in the app) so the app can trust x-client-ip.
export async function onRequest({ request, env }) {
  const url = new URL(request.url)
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('x-client-ip', request.headers.get('cf-connecting-ip') ?? '')
  headers.set('x-proxy-secret', env.PROXY_SECRET)
  return fetch(new URL(url.pathname + url.search, env.ORIGIN), {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  })
}
