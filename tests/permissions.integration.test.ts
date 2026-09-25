// Con el rol web_reader nunca se lee teléfono ni correo; la licencia solo de perfiles reclamados y publicados.
// Requiere Postgres local: `npm run db:up`.
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from '@/scripts/migrate'
import { freshDatabase } from './pg'

const db = await freshDatabase('dochis_test_permissions')
let reader: postgres.Sql
let writer: postgres.Sql

beforeAll(() => {
  if (!db) return
  reader = postgres(db.readerUrl, { max: 1, onnotice: () => {} })
  writer = postgres(db.writerUrl, { max: 1, onnotice: () => {} })
})
afterAll(async () => { await reader?.end(); await writer?.end() })

const code = (p: Promise<unknown>) => p.then(() => 'ok', (e) => e.code as string)

describe.skipIf(!db)('permisos de base de datos', () => {
  it('las migraciones son idempotentes (segunda pasada sin errores)', async () => {
    await expect(migrate(db!)).resolves.toEqual([])
  })

  it('web_reader no puede leer la tabla doctors', async () => {
    expect(await code(reader`select * from doctors`)).toBe('42501')
  })

  it('web_reader no puede pedir columnas privadas a la vista', async () => {
    for (const col of ['phone_e164', 'email', 'consent_at']) {
      expect(await code(reader`select ${reader(col)} from public_doctors`), col).toBe('42703')
    }
  })

  it('la vista no expone datos privados ni perfiles ocultos o pendientes', async () => {
    const rows = await reader`select * from public_doctors`
    expect(rows).toHaveLength(14)
    for (const r of rows) for (const col of ['phone_e164', 'email', 'consent_at']) expect(r).not.toHaveProperty(col)
    const slugs = rows.map((r) => r.slug)
    expect(slugs).not.toContain('dr-oculto-pendiente')
    expect(slugs).not.toContain('dra-oculta-hidden')
    const json = JSON.stringify(rows)
    expect(json).not.toMatch(/example\.com/)  // login emails never leak (public WhatsApp numbers are consented)
    // Licences are public (for checking in the official registry) only on claimed, published profiles.
    expect(json).not.toMatch(/DHA-9999[89]/)
    expect(rows.find((r) => r.slug === 'dra-lucia-marquez-ortega')?.license_number).toBe('DHA-10001')
  })

  it('perfiles sin reclamar solo muestran nombre, especialidad, clínica, zona y emirato', async () => {
    const rows = await reader`select * from public_doctors where status = 'unclaimed'`
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r).toMatchObject({ languages: [], insurances: [], regulator: null, public_whatsapp: null, last_confirmed_at: null, license_number: null })
    }
  })

  it('WhatsApp público solo con consentimiento', async () => {
    const [r] = await reader`select public_whatsapp from public_doctors where slug = 'dr-javier-soler-pons'`
    expect(r.public_whatsapp).toBeNull()
  })

  it('la licencia no se publica si el profesional pidió ocultarla, pero sí el regulador', async () => {
    const [r] = await reader`select regulator, license_number from public_doctors where slug = 'dr-sebastian-rojas'`
    expect(r.regulator).toBe('DHA')
    expect(r.license_number).toBeNull()
  })

  it('un perfil sin reclamar nunca filtra la licencia aunque show_license sea el valor por defecto', async () => {
    const rows = await reader`select license_number from public_doctors where status = 'unclaimed'`
    expect(rows.every((r) => r.license_number === null)).toBe(true)
  })

  it('web_reader no puede leer tablas internas ni escribir', async () => {
    for (const t of ['login_challenges', 'bot_sessions', 'reports', 'verification_requests', 'admins', 'confirmations']) {
      expect(await code(reader`select * from ${reader(t)}`), t).toBe('42501')
    }
    expect(await code(reader`insert into reports (doctor_id, reporter_fingerprint, reason) select id, 'x', 'x' from public_doctors limit 1`)).toBe('42501')
    expect(await code(reader`update public_doctors set full_name = 'Hack'`)).not.toBe('ok')
  })

  it('el historial público solo incluye médicos visibles y reclamados', async () => {
    const conf = await reader`select doctor_id from public_confirmations`
    const visible = new Set((await reader`select id from public_doctors where status in ('verified', 'stale')`).map((r) => r.id))
    expect(conf.length).toBeGreaterThan(0)
    for (const c of conf) expect(visible.has(c.doctor_id)).toBe(true)
  })

  it('las fotos solo se leen de perfiles publicados', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
    await writer`update doctors set photo = ${jpeg}, photo_type = 'image/jpeg', photo_updated_at = now() where slug in ('dra-lucia-marquez-ortega', 'dra-oculta-hidden')`
    const rows = await reader`select slug, photo_type from public_photos`
    expect(rows.map((r) => r.slug)).toEqual(['dra-lucia-marquez-ortega'])
    const [pub] = await reader`select photo_version from public_doctors where slug = 'dra-lucia-marquez-ortega'`
    expect(Number(pub.photo_version)).toBeGreaterThan(0)
  })

  it('app_writer escribe datos pero no puede cambiar el esquema', async () => {
    expect(await code(writer`insert into reports (doctor_id, reporter_fingerprint, reason) select id, 'fp', 'Otro' from doctors limit 1`)).toBe('ok')
    expect(await code(writer`drop table reports`)).toBe('42501')
    expect(await code(writer`create table hack (id int)`)).toBe('42501')
  })
})
