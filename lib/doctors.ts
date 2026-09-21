import 'server-only'
import { cache } from 'react'
import { publicClient } from './supabase'
import type { PublicDoctor } from './directory'

const COLUMNS = 'id, slug, full_name, specialty, clinic, area, emirate, languages, insurances, regulator, public_whatsapp, status, last_confirmed_at'

// ponytail: loads the whole public directory (~350 rows); paginate server-side if it grows past a few thousand.
export async function getPublicDoctors(): Promise<PublicDoctor[]> {
  const { data, error } = await publicClient().from('public_doctors').select(COLUMNS)
  if (error) throw new Error(`No se pudo leer el directorio: ${error.message}`)
  return data as PublicDoctor[]
}

// cache(): generateMetadata and the page share one query per request.
export const getDoctorBySlug = cache(async (slug: string) => {
  const client = publicClient()
  const { data, error } = await client.from('public_doctors').select(COLUMNS).eq('slug', slug).maybeSingle()
  if (error) throw new Error(`No se pudo leer el perfil: ${error.message}`)
  if (!data) return null
  const { data: conf } = await client.from('public_confirmations').select('confirmed_at').eq('doctor_id', data.id)
  return { doctor: data as PublicDoctor, confirmations: (conf ?? []).map((c) => c.confirmed_at as string) }
})
