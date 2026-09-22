import { writer } from '@/lib/db'
import { findDoctorByIdentity } from '@/lib/onboarding'
import { getSession } from '@/lib/session'

// The doctor's own photo, visible to them even before the profile is published.
export async function GET() {
  const session = await getSession()
  const d = session && (await findDoctorByIdentity(writer(), session.phone ?? session.email))
  if (!d?.photo) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(d.photo), {
    headers: { 'Content-Type': d.photo_type, 'Cache-Control': 'private, max-age=60', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" },
  })
}
