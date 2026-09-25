// Alta y edición con revisión automática, y revisión de los marcados. Postgres real (rol app_writer).
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  approveRequest, findDoctorByIdentity, getReviewer, listPendingRequests, pendingRequestFor, rejectRequest, saveOwnProfile, signUp,
} from '@/lib/onboarding'
import type { ProfileData } from '@/lib/profile'
import type { Review } from '@/lib/review'
import { freshDatabase } from './pg'

const db = await freshDatabase('dochis_test_onboarding', { seed: true })
let sql: postgres.Sql
let reader: postgres.Sql

const OK: Review = { ok: true, issues: [] }
const FLAG: Review = { ok: false, issues: ['Esa licencia ya está en otro perfil del directorio.'] }
const data = (over: Partial<ProfileData> = {}): ProfileData => ({
  full_name: 'Dra. Nueva Pérez', specialty: 'Pediatría', clinic: 'Clínica Nueva', area: 'Al Barsha', emirate: 'Dubái',
  languages: ['Español'], insurances: ['Daman'], regulator: 'DHA', license_number: '77777777', show_license: true, public_whatsapp: null, insurance_url: null, ...over,
})
const doctorBySlug = async (slug: string) => (await sql`select * from doctors where slug = ${slug}`)[0]
const publicRow = async (slug: string) => (await reader`select * from public_doctors where slug = ${slug}`)[0]

beforeAll(async () => {
  if (!db) return
  sql = postgres(db.writerUrl, { max: 2, onnotice: () => {} })
  reader = postgres(db.readerUrl, { max: 1, onnotice: () => {} })
  await sql`insert into admins (identity, role, scope) values ('admin@example.com', 'admin', null), ('+971500000077', 'ambassador', 'Cardiología')`
})
afterAll(async () => { await sql?.end(); await reader?.end() })

describe.skipIf(!db)('alta con revisión automática', () => {
  it('revisión limpia: se publica al instante, con licencia visible y confirmada hoy', async () => {
    const r = await signUp(sql, 'nueva@example.com', data(), OK)
    expect(r.published).toBe(true)
    expect(await publicRow(r.slug)).toMatchObject({ status: 'verified', license_number: '77777777', regulator: 'DHA' })
    expect((await doctorBySlug(r.slug)).last_confirmed_at).not.toBeNull()
    expect(await pendingRequestFor(sql, 'nueva@example.com')).toBeNull()
    expect((await findDoctorByIdentity(sql, 'NUEVA@example.com'))?.slug).toBe(r.slug)
  })

  it('revisión marcada: no se publica y aparece con los motivos para el admin', async () => {
    const r = await signUp(sql, 'marcada@example.com', data({ full_name: 'Dr. Marcado' }), FLAG)
    expect(r.published).toBe(false)
    expect(await publicRow(r.slug)).toBeUndefined()
    const admin = (await getReviewer(sql, 'admin@example.com'))!
    const req = (await listPendingRequests(sql, admin)).find((x) => x.doctor_slug === r.slug)!
    expect(req.payload.issues).toEqual(FLAG.issues)
  })

  it('al publicarse, oculta el perfil importado sin reclamar con el mismo nombre', async () => {
    expect((await doctorBySlug('dr-rafael-montoya')).status).toBe('unclaimed')
    const r = await signUp(sql, 'rafael@example.com', data({ full_name: 'Dr. Rafael Montoya', specialty: 'Urología' }), OK)
    expect((await doctorBySlug('dr-rafael-montoya')).status).toBe('hidden')
    expect((await publicRow(r.slug)).status).toBe('verified')
  })

  it('el slug es único aunque se repita el nombre', async () => {
    const a = await signUp(sql, '+971501110001', data({ full_name: 'Dr. Repetido' }), OK)
    const b = await signUp(sql, '+971501110002', data({ full_name: 'Dr. Repetido' }), FLAG)
    expect([a.slug, b.slug]).toEqual(['dr-repetido', 'dr-repetido-2'])
  })
})

describe.skipIf(!db)('edición del propio perfil', () => {
  it('limpia: se guarda y cuenta como confirmación del mes', async () => {
    const lucia = await doctorBySlug('dra-lucia-marquez-ortega')
    const before = (await sql`select count(*)::int as n from confirmations where doctor_id = ${lucia.id}`)[0].n
    expect(await saveOwnProfile(sql, lucia.phone_e164, data({ full_name: lucia.full_name, license_number: lucia.license_number, clinic: 'Nueva Sede' }), OK)).toBe('saved')
    expect(await doctorBySlug('dra-lucia-marquez-ortega')).toMatchObject({ status: 'verified', clinic: 'Nueva Sede' })
    expect((await sql`select count(*)::int as n from confirmations where doctor_id = ${lucia.id}`)[0].n).toBe(before + 1)
  })

  it('marcada sin cambiar la licencia: sigue publicado (un falso positivo no oculta a nadie) y queda para revisar', async () => {
    const omar = await doctorBySlug('dr-omar-haddad')
    expect(await saveOwnProfile(sql, omar.phone_e164, data({ full_name: omar.full_name, license_number: omar.license_number, regulator: 'MOHAP' }), FLAG)).toBe('saved')
    expect((await doctorBySlug('dr-omar-haddad')).status).toBe('verified')
    expect(await pendingRequestFor(sql, omar.phone_e164)).toMatchObject({ kind: 'license' })
  })

  it('marcada con licencia nueva: deja de ser público hasta revisarse', async () => {
    const andres = await doctorBySlug('dr-andres-villalba')
    expect(await saveOwnProfile(sql, andres.phone_e164, data({ full_name: andres.full_name, license_number: '99999999' }), FLAG)).toBe('pending')
    expect(await publicRow('dr-andres-villalba')).toBeUndefined()
  })

  it('perfil importado reclamado con su teléfono: revisión limpia lo publica', async () => {
    const paula = await doctorBySlug('dra-paula-echeverri')
    expect(paula.status).toBe('unclaimed')
    expect(await saveOwnProfile(sql, paula.phone_e164, data({ full_name: paula.full_name, specialty: 'Neurología', license_number: '55555555' }), OK)).toBe('saved')
    expect((await publicRow('dra-paula-echeverri')).status).toBe('verified')
  })
})

describe.skipIf(!db)('revisión de marcados', () => {
  it('aprobar publica; rechazar oculta', async () => {
    const admin = (await getReviewer(sql, 'admin@example.com'))!
    const a = await signUp(sql, 'a@example.com', data({ full_name: 'Dra. Aprobable' }), FLAG)
    const b = await signUp(sql, 'b@example.com', data({ full_name: 'Dr. Rechazable' }), FLAG)
    const reqs = await listPendingRequests(sql, admin)
    await approveRequest(sql, reqs.find((r) => r.doctor_slug === a.slug)!.id, admin)
    await rejectRequest(sql, reqs.find((r) => r.doctor_slug === b.slug)!.id, admin)
    expect((await publicRow(a.slug)).status).toBe('verified')
    expect((await doctorBySlug(b.slug)).status).toBe('hidden')
  })

  it('el embajador solo ve y resuelve su especialidad', async () => {
    const amb = (await getReviewer(sql, '+971500000077'))!
    const admin = (await getReviewer(sql, 'admin@example.com'))!
    const card = await signUp(sql, 'cardio@example.com', data({ full_name: 'Dr. Corazón', specialty: 'Cardiología' }), FLAG)
    const pedi = await signUp(sql, 'pedi@example.com', data({ full_name: 'Dra. Niños' }), FLAG)
    expect((await listPendingRequests(sql, amb)).every((r) => r.doctor_specialty === 'Cardiología')).toBe(true)
    const pediReq = (await listPendingRequests(sql, admin)).find((r) => r.doctor_slug === pedi.slug)!
    await expect(approveRequest(sql, pediReq.id, amb)).rejects.toThrow(/ámbito/)
    await approveRequest(sql, (await listPendingRequests(sql, amb)).find((r) => r.doctor_slug === card.slug)!.id, amb)
    expect((await doctorBySlug(card.slug)).status).toBe('verified')
  })

  it('quien no está en admins no es revisor', async () => {
    expect(await getReviewer(sql, 'nadie@example.com')).toBeNull()
  })
})
