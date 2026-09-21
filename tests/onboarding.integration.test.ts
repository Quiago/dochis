// Alta, reclamo, edición y revisión contra Postgres real (rol app_writer). Requiere `npm run db:up`.
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  approveRequest, findDoctorByIdentity, getReviewer, listPendingRequests, pendingRequestFor, rejectRequest,
  saveOwnProfile, signUp, submitClaim,
} from '@/lib/onboarding'
import type { ProfileData } from '@/lib/profile'
import { freshDatabase } from './pg'

const db = await freshDatabase('dochis_test_onboarding', { seed: true })
let sql: postgres.Sql
let reader: postgres.Sql

const data = (over: Partial<ProfileData> = {}): ProfileData => ({
  full_name: 'Dra. Nueva Pérez', specialty: 'Pediatría', clinic: 'Clínica Nueva', area: 'Al Barsha', emirate: 'Dubái',
  languages: ['Español'], insurances: ['Daman'], regulator: 'DHA', license_number: 'DHA-77777', public_whatsapp: null, ...over,
})
const doctorBySlug = async (slug: string) => (await sql`select * from doctors where slug = ${slug}`)[0]
const isPublic = async (slug: string) => (await reader`select 1 from public_doctors where slug = ${slug}`).length === 1

beforeAll(async () => {
  if (!db) return
  sql = postgres(db.writerUrl, { max: 2, onnotice: () => {} })
  reader = postgres(db.readerUrl, { max: 1, onnotice: () => {} })
  await sql`insert into admins (identity, role, scope) values ('admin@example.com', 'admin', null), ('+971500000077', 'ambassador', 'Cardiología')`
})
afterAll(async () => { await sql?.end(); await reader?.end() })

describe.skipIf(!db)('onboarding de médicos', () => {
  it('alta nueva: queda pendiente, no es pública y genera solicitud', async () => {
    const r = await signUp(sql, 'nueva@example.com', data())
    const d = await doctorBySlug(r.slug)
    expect(d).toMatchObject({ status: 'pending_verification', email: 'nueva@example.com', phone_e164: null })
    expect(d.consent_at).not.toBeNull()
    expect(await isPublic(r.slug)).toBe(false)
    expect(await pendingRequestFor(sql, 'nueva@example.com')).toMatchObject({ kind: 'signup' })
    expect((await findDoctorByIdentity(sql, 'NUEVA@example.com'))?.slug).toBe(r.slug)
  })

  it('el slug es único aunque se repita el nombre', async () => {
    const a = await signUp(sql, '+971501110001', data({ full_name: 'Dr. Repetido' }))
    const b = await signUp(sql, '+971501110002', data({ full_name: 'Dr. Repetido' }))
    expect(a.slug).toBe('dr-repetido')
    expect(b.slug).toBe('dr-repetido-2')
  })

  it('médico verificado edita sin tocar la licencia: se aplica y cuenta como confirmación', async () => {
    const lucia = await doctorBySlug('dra-lucia-marquez-ortega')
    const before = (await sql`select count(*)::int as n from confirmations where doctor_id = ${lucia.id}`)[0].n
    const r = await saveOwnProfile(sql, lucia.phone_e164, data({ full_name: lucia.full_name, clinic: 'Clínica Nueva Sede', regulator: 'DHA', license_number: lucia.license_number }))
    expect(r).toBe('saved')
    const after = await doctorBySlug('dra-lucia-marquez-ortega')
    expect(after).toMatchObject({ status: 'verified', clinic: 'Clínica Nueva Sede' })
    expect(Date.now() - after.last_confirmed_at.getTime()).toBeLessThan(60_000)
    expect((await sql`select count(*)::int as n from confirmations where doctor_id = ${lucia.id}`)[0].n).toBe(before + 1)
  })

  it('perfil pendiente (stale) que confirma vuelve a verificado', async () => {
    const javier = await doctorBySlug('dr-javier-soler-pons')
    await saveOwnProfile(sql, javier.phone_e164, data({ full_name: javier.full_name, license_number: javier.license_number, regulator: 'DHA' }))
    expect((await doctorBySlug('dr-javier-soler-pons')).status).toBe('verified')
  })

  it('cambiar la licencia vuelve a revisión', async () => {
    const andres = await doctorBySlug('dr-andres-villalba')
    expect(await saveOwnProfile(sql, andres.phone_e164, data({ full_name: andres.full_name, license_number: 'DHA-NUEVA' }))).toBe('pending')
    expect((await doctorBySlug('dr-andres-villalba')).status).toBe('pending_verification')
    expect(await pendingRequestFor(sql, andres.phone_e164)).toMatchObject({ kind: 'license' })
  })

  it('reclamo de un perfil ajeno: no cambia nada hasta que se aprueba', async () => {
    const rafael = await doctorBySlug('dr-rafael-montoya')
    await submitClaim(sql, 'rafael@example.com', rafael.id, data({ full_name: 'Dr. Rafael Montoya', specialty: 'Urología', license_number: 'DOH-555', regulator: 'DOH', emirate: 'Abu Dabi' }))
    await submitClaim(sql, 'impostor@example.com', rafael.id, data({ full_name: 'Dr. Impostor', specialty: 'Urología' }))
    expect(await doctorBySlug('dr-rafael-montoya')).toMatchObject({ status: 'unclaimed', full_name: 'Dr. Rafael Montoya', email: null })
    expect(await findDoctorByIdentity(sql, 'rafael@example.com')).toBeNull()

    const admin = (await getReviewer(sql, 'admin@example.com'))!
    const claims = (await listPendingRequests(sql, admin)).filter((r) => r.doctor_id === rafael.id)
    expect(claims).toHaveLength(2)
    const real = claims.find((c) => c.identity === 'rafael@example.com')!
    await approveRequest(sql, real.id, admin)

    expect(await doctorBySlug('dr-rafael-montoya')).toMatchObject({ status: 'verified', email: 'rafael@example.com', license_number: 'DOH-555', emirate: 'Abu Dabi' })
    expect(await isPublic('dr-rafael-montoya')).toBe(true)
    const others = await sql`select status from verification_requests where doctor_id = ${rafael.id} and identity = 'impostor@example.com'`
    expect(others[0].status).toBe('rejected')
  })

  it('rechazar un alta la oculta', async () => {
    const r = await signUp(sql, 'falsa@example.com', data({ full_name: 'Dr. Falso' }))
    const admin = (await getReviewer(sql, 'admin@example.com'))!
    const req = (await listPendingRequests(sql, admin)).find((x) => x.doctor_slug === r.slug)!
    await rejectRequest(sql, req.id, admin)
    expect((await doctorBySlug(r.slug)).status).toBe('hidden')
    expect(await pendingRequestFor(sql, 'falsa@example.com')).toBeNull()
  })

  it('el embajador solo ve y aprueba solicitudes de su especialidad', async () => {
    const amb = (await getReviewer(sql, '+971500000077'))!
    const card = await signUp(sql, 'cardio@example.com', data({ full_name: 'Dr. Corazón', specialty: 'Cardiología' }))
    const pedi = await signUp(sql, 'pedi@example.com', data({ full_name: 'Dra. Niños', specialty: 'Pediatría' }))
    const visible = await listPendingRequests(sql, amb)
    expect(visible.every((r) => r.doctor_specialty === 'Cardiología')).toBe(true)
    const admin = (await getReviewer(sql, 'admin@example.com'))!
    const pediReq = (await listPendingRequests(sql, admin)).find((r) => r.doctor_slug === pedi.slug)!
    await expect(approveRequest(sql, pediReq.id, amb)).rejects.toThrow(/ámbito/)
    const cardReq = visible.find((r) => r.doctor_slug === card.slug)!
    await approveRequest(sql, cardReq.id, amb)
    expect((await doctorBySlug(card.slug)).status).toBe('verified')
  })

  it('quien no está en admins no es revisor', async () => {
    expect(await getReviewer(sql, 'nadie@example.com')).toBeNull()
  })
})
