// Frescura automática, reportes comunitarios y vistas de admin de la Fase 4. Requiere `npm run db:up`.
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { dismissReports, listReports, reportDoctor, roundStart, runFreshness, unconfirmedThisRound } from '@/lib/freshness'
import type { Reviewer } from '@/lib/onboarding'
import { freshDatabase } from './pg'

const db = await freshDatabase('dochis_test_freshness', { seed: true })
let sql: postgres.Sql
const NOW = new Date('2026-09-21T12:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000)
const ADMIN: Reviewer = { identity: 'a@x.com', role: 'admin', scope: null }
const status = async (slug: string) => (await sql`select status from doctors where slug = ${slug}`)[0].status
const setConfirmed = (slug: string, days: number, st = 'verified') =>
  sql`update doctors set status = ${st}, last_confirmed_at = ${ago(days)} where slug = ${slug}`

beforeAll(() => { if (db) sql = postgres(db.writerUrl, { max: 2, onnotice: () => {} }) })
beforeEach(async () => { if (db) await sql`delete from reports` })
afterAll(async () => { await sql?.end() })

describe('ronda trimestral', () => {
  it('empieza el primer día del trimestre (UTC)', () => {
    expect(roundStart(new Date('2026-09-21T12:00:00Z')).toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(roundStart(new Date('2026-01-01T00:00:00Z')).toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(roundStart(new Date('2026-12-31T23:59:00Z')).toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })
})

describe.skipIf(!db)('cron de frescura', () => {
  it('pasa a pendiente a los 90 días y oculta a los 180', async () => {
    await setConfirmed('dra-lucia-marquez-ortega', 10)
    await setConfirmed('dr-tomas-aguirre', 95)
    await setConfirmed('dr-andres-villalba', 185)
    await setConfirmed('dr-mateo-guzman', 181, 'stale')
    const r = await runFreshness(sql, NOW)
    expect(await status('dra-lucia-marquez-ortega')).toBe('verified')
    expect(await status('dr-tomas-aguirre')).toBe('stale')
    expect(await status('dr-andres-villalba')).toBe('hidden')
    expect(await status('dr-mateo-guzman')).toBe('hidden')
    expect(r.hidden).toBeGreaterThanOrEqual(2)
    expect(r.stale).toBeGreaterThanOrEqual(1)
  })

  it('no toca perfiles sin reclamar ni pendientes de verificación', async () => {
    await runFreshness(sql, NOW)
    expect(await status('dr-rafael-montoya')).toBe('unclaimed')
    expect(await status('dr-oculto-pendiente')).toBe('pending_verification')
  })
})

describe.skipIf(!db)('reportes "Ya no está aquí"', () => {
  it('dos personas distintas lo pasan a pendiente', async () => {
    await setConfirmed('dra-florencia-paz', 3)
    expect(await reportDoctor(sql, { slug: 'dra-florencia-paz', reason: 'Se fue del país', fingerprint: 'fp-1', now: NOW })).toBe('ok')
    expect(await status('dra-florencia-paz')).toBe('verified')
    expect(await reportDoctor(sql, { slug: 'dra-florencia-paz', reason: 'Cambió de clínica', fingerprint: 'fp-2', now: NOW })).toBe('ok')
    expect(await status('dra-florencia-paz')).toBe('stale')
  })

  it('la misma persona dos veces no cuenta doble', async () => {
    await setConfirmed('dra-valentina-ibarra', 3)
    await reportDoctor(sql, { slug: 'dra-valentina-ibarra', reason: 'Otro', fingerprint: 'fp-1', now: NOW })
    expect(await reportDoctor(sql, { slug: 'dra-valentina-ibarra', reason: 'Otro', fingerprint: 'fp-1', now: NOW })).toBe('duplicate')
    expect(await status('dra-valentina-ibarra')).toBe('verified')
  })

  it('los reportes de hace más de 30 días no cuentan', async () => {
    await setConfirmed('dra-ines-carrasco', 3)
    const [d] = await sql`select id from doctors where slug = 'dra-ines-carrasco'`
    await sql`insert into reports (doctor_id, reporter_fingerprint, reason, created_at) values (${d.id}, 'viejo', 'Otro', ${ago(40)})`
    await reportDoctor(sql, { slug: 'dra-ines-carrasco', reason: 'Otro', fingerprint: 'nuevo', now: NOW })
    expect(await status('dra-ines-carrasco')).toBe('verified')
  })

  it('solo se reportan perfiles públicos reclamados, con motivo válido y con límite diario', async () => {
    expect(await reportDoctor(sql, { slug: 'dr-oculto-pendiente', reason: 'Otro', fingerprint: 'x', now: NOW })).toBe('not_found')
    expect(await reportDoctor(sql, { slug: 'dr-rafael-montoya', reason: 'Otro', fingerprint: 'x', now: NOW })).toBe('not_found')
    expect(await reportDoctor(sql, { slug: 'dra-nadia-farouk', reason: 'Me cae mal', fingerprint: 'x', now: NOW })).toBe('invalid_reason')
    // 10 reports in the last day by the same person (any profiles) → the 11th is refused.
    await sql`insert into reports (doctor_id, reporter_fingerprint, reason, created_at)
              select id, 'spammer', 'Otro', ${ago(0.5)} from doctors where slug <> 'dra-nadia-farouk' limit 10`
    expect(await reportDoctor(sql, { slug: 'dra-nadia-farouk', reason: 'Otro', fingerprint: 'spammer', now: NOW })).toBe('rate_limited')
  })

  it('el admin ve los reportes y al descartarlos el perfil vuelve a confirmado', async () => {
    await setConfirmed('dra-camila-restrepo', 5)
    await reportDoctor(sql, { slug: 'dra-camila-restrepo', reason: 'Se fue del país', fingerprint: 'a', now: NOW })
    await reportDoctor(sql, { slug: 'dra-camila-restrepo', reason: 'Otro', fingerprint: 'b', now: NOW })
    const rows = await listReports(sql, ADMIN, NOW)
    const camila = rows.find((r) => r.slug === 'dra-camila-restrepo')!
    expect(camila).toMatchObject({ count: 2 })
    expect(camila.reasons).toEqual(expect.arrayContaining(['Se fue del país', 'Otro']))
    await dismissReports(sql, camila.doctor_id, ADMIN, NOW)
    expect(await status('dra-camila-restrepo')).toBe('verified')
    expect((await listReports(sql, ADMIN, NOW)).find((r) => r.slug === 'dra-camila-restrepo')).toBeUndefined()
  })
})

describe.skipIf(!db)('sin confirmar esta ronda', () => {
  it('lista con teléfono y correo a quienes no confirmaron desde el inicio del trimestre, según el ámbito', async () => {
    await setConfirmed('dra-nadia-farouk', 100)      // antes del 1 de julio
    await setConfirmed('dr-sebastian-rojas', 10)     // dentro de la ronda
    const all = await unconfirmedThisRound(sql, ADMIN, NOW)
    const slugs = all.map((r) => r.slug)
    expect(slugs).toContain('dra-nadia-farouk')
    expect(slugs).not.toContain('dr-sebastian-rojas')
    expect(all.find((r) => r.slug === 'dra-nadia-farouk')).toMatchObject({ phone_e164: '+971500000009' })
    const amb = await unconfirmedThisRound(sql, { identity: 'b@x.com', role: 'ambassador', scope: 'Cardiología' }, NOW)
    expect(amb.every((r) => r.specialty === 'Cardiología')).toBe(true)
  })
})
