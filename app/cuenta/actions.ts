'use server'
import { redirect } from 'next/navigation'
import { writer } from '@/lib/db'
import { findDoctorByIdentity, saveOwnProfile, signUp, submitClaim } from '@/lib/onboarding'
import { parseProfileForm } from '@/lib/profile'
import { getSession } from '@/lib/session'

export type FormState = { errors?: Record<string, string> }

// The case (own profile / claim / sign-up) is decided here again: never trust the client.
export async function saveProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect('/entrar')
  const identity = session.phone ?? session.email
  const { data, errors } = parseProfileForm(fd)
  if (!data) return { errors }

  const sql = writer()
  const own = await findDoctorByIdentity(sql, identity)
  let estado: string
  if (own) {
    estado = await saveOwnProfile(sql, identity, data)
  } else {
    const slug = String(fd.get('medico') ?? '')
    const [target] = slug ? await sql`select id from doctors where slug = ${slug} and status in ('unclaimed', 'verified', 'stale')` : []
    if (target) {
      await submitClaim(sql, identity, target.id, data)
      estado = 'claim'
    } else {
      await signUp(sql, identity, data)
      estado = 'pending'
    }
  }
  redirect(`/cuenta/listo?estado=${estado}`)
}
