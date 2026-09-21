'use server'
import { redirect } from 'next/navigation'
import { writer } from '@/lib/db'
import { findDoctorByIdentity, saveOwnProfile, signUp } from '@/lib/onboarding'
import { parseProfileForm } from '@/lib/profile'
import { reviewProfile } from '@/lib/review'
import { getSession } from '@/lib/session'

export type FormState = { errors?: Record<string, string> }

// Own profile (matched by the session's phone/email) or a new one. The automatic review decides whether it is
// published at once or waits in "Marcados para revisar". Never trust the client for which case applies.
export async function saveProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect('/entrar')
  const identity = session.phone ?? session.email
  const { data, errors } = parseProfileForm(fd)
  if (!data) return { errors }

  const sql = writer()
  const own = await findDoctorByIdentity(sql, identity)
  const review = await reviewProfile(sql, data, { excludeId: own?.id })
  const estado = own
    ? await saveOwnProfile(sql, identity, data, review)
    : (await signUp(sql, identity, data, review)).published ? 'published' : 'pending'
  redirect(`/cuenta/listo?estado=${estado}`)
}
