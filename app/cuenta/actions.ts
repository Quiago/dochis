'use server'
import { redirect } from 'next/navigation'
import { writer } from '@/lib/db'
import { findDoctorByIdentity, saveOwnProfile, signUp } from '@/lib/onboarding'
import { formValues, parseProfileForm, type FormValues } from '@/lib/profile'
import { photoIssue, setPhoto, validatePhoto } from '@/lib/photo'
import { reviewProfile } from '@/lib/review'
import { getSession } from '@/lib/session'

export type FormState = { errors?: Record<string, string>; values?: FormValues }

// Own profile (matched by the session's phone/email) or a new one. The automatic review decides whether it is
// published at once or waits in "Marcados para revisar". Never trust the client for which case applies.
export async function saveProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect('/entrar')
  const identity = session.phone ?? session.email
  const { data, errors } = parseProfileForm(fd)
  // React 19 resets an uncontrolled form after the action runs, so an error return carries back what was
  // typed (the photo file input excepted: browsers never let a script refill it).
  const values = formValues(fd)
  if (!data) return { errors, values }

  // Optional photo: validated by its bytes and reviewed before anything is saved.
  const file = fd.get('photo')
  let photo: { bytes: Uint8Array; type: 'image/jpeg' | 'image/webp' } | null = null
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const v = validatePhoto(bytes)
    if ('error' in v) return { errors: { photo: v.error }, values }
    const issue = await photoIssue(bytes, v.type)
    if (issue) return { errors: { photo: `No podemos usar esa foto: ${issue}` }, values }
    photo = { bytes, type: v.type }
  }

  const sql = writer()
  const own = await findDoctorByIdentity(sql, identity)
  const review = await reviewProfile(sql, data, { excludeId: own?.id })
  let estado: string
  let doctorId: string
  if (own) {
    estado = await saveOwnProfile(sql, identity, data, review)
    doctorId = own.id
  } else {
    const created = await signUp(sql, identity, data, review)
    estado = created.published ? 'published' : 'pending'
    doctorId = created.id
  }
  if (photo) await setPhoto(sql, doctorId, photo.bytes, photo.type)
  else if (fd.get('remove_photo')) await setPhoto(sql, doctorId, null, null)
  redirect(`/cuenta/listo?estado=${estado}`)
}
