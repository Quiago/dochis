import { reader } from '@/lib/db'

// Served only for published profiles (public_photos view). URLs carry ?v=<version>, so caching can be long.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const [row] = await reader()`select photo, photo_type from public_photos where slug = ${(await params).slug}`
  if (!row) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(row.photo), {
    headers: {
      'Content-Type': row.photo_type,
      'Cache-Control': 'public, max-age=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
