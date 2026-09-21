import 'server-only'
import { cache } from 'react'
import { reader } from './db'
import type { PublicDoctor } from './directory'

type Row = Omit<PublicDoctor, 'last_confirmed_at'> & { last_confirmed_at: Date | null }
const toDoctor = (r: Row): PublicDoctor => ({ ...r, last_confirmed_at: r.last_confirmed_at?.toISOString() ?? null })

// ponytail: loads the whole public directory (~350 rows); paginate in SQL if it grows past a few thousand.
export async function getPublicDoctors(): Promise<PublicDoctor[]> {
  const rows = await reader()<Row[]>`
    select id, slug, full_name, specialty, clinic, area, emirate, languages, insurances,
           regulator, public_whatsapp, status, last_confirmed_at
    from public_doctors`
  return rows.map(toDoctor)
}

// cache(): generateMetadata and the page share one query per request.
export const getDoctorBySlug = cache(async (slug: string) => {
  const [row] = await reader()<Row[]>`
    select id, slug, full_name, specialty, clinic, area, emirate, languages, insurances,
           regulator, public_whatsapp, status, last_confirmed_at
    from public_doctors where slug = ${slug}`
  if (!row) return null
  const conf = await reader()<{ confirmed_at: Date }[]>`select confirmed_at from public_confirmations where doctor_id = ${row.id}`
  return { doctor: toDoctor(row), confirmations: conf.map((c) => c.confirmed_at.toISOString()) }
})
