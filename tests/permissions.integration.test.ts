// Criterio de "listo": con el rol web_reader no se puede leer teléfono, correo ni licencia.
// Requiere Postgres local: `npm run db:up`. Usa una base aparte (dochis_test) que recrea. Los roles son
// del clúster: se usan las mismas contraseñas locales que .env.example para no romper la base de desarrollo.
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from '@/scripts/migrate'

const HOST = process.env.TEST_PG_HOST ?? 'localhost:5433'
const url = (user: string, pass: string, db = 'dochis_test') => `postgres://${user}:${pass}@${HOST}/${db}`
const ADMIN = url('postgres', 'postgres')
const READER = url('web_reader', 'reader_local')
const WRITER = url('app_writer', 'writer_local')

async function available() {
  const sql = postgres(url('postgres', 'postgres', 'postgres'), { max: 1, connect_timeout: 2, onnotice: () => {} })
  try {
    await sql`drop database if exists dochis_test with (force)`
    await sql`create database dochis_test`
    return true
  } catch {
    return false
  } finally {
    await sql.end()
  }
}

const up = await available()
let reader: postgres.Sql
let writer: postgres.Sql

beforeAll(async () => {
  if (!up) return
  await migrate({ adminUrl: ADMIN, readerUrl: READER, writerUrl: WRITER, seed: true })
  reader = postgres(READER, { max: 1, onnotice: () => {} })
  writer = postgres(WRITER, { max: 1, onnotice: () => {} })
})
afterAll(async () => { await reader?.end(); await writer?.end() })

const code = (p: Promise<unknown>) => p.then(() => 'ok', (e) => e.code as string)

describe.skipIf(!up)('permisos de base de datos', () => {
  it('las migraciones son idempotentes (segunda pasada sin errores)', async () => {
    await expect(migrate({ adminUrl: ADMIN, readerUrl: READER, writerUrl: WRITER })).resolves.toEqual([])
  })

  it('web_reader no puede leer la tabla doctors', async () => {
    expect(await code(reader`select * from doctors`)).toBe('42501')
  })

  it('web_reader no puede pedir columnas privadas a la vista', async () => {
    for (const col of ['phone_e164', 'email', 'license_number']) {
      expect(await code(reader`select ${reader(col)} from public_doctors`), col).toBe('42703')
    }
  })

  it('la vista no expone datos privados ni perfiles ocultos o pendientes', async () => {
    const rows = await reader`select * from public_doctors`
    expect(rows).toHaveLength(14)
    for (const r of rows) for (const col of ['phone_e164', 'email', 'license_number', 'consent_at']) expect(r).not.toHaveProperty(col)
    const slugs = rows.map((r) => r.slug)
    expect(slugs).not.toContain('dr-oculto-pendiente')
    expect(slugs).not.toContain('dra-oculta-hidden')
    expect(JSON.stringify(rows)).not.toMatch(/example\.com|DHA-|DOH-|MOH-/)
  })

  it('perfiles sin reclamar solo muestran nombre, especialidad, clínica, zona y emirato', async () => {
    const rows = await reader`select * from public_doctors where status = 'unclaimed'`
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r).toMatchObject({ languages: [], insurances: [], regulator: null, public_whatsapp: null, last_confirmed_at: null })
    }
  })

  it('WhatsApp público solo con consentimiento', async () => {
    const [r] = await reader`select public_whatsapp from public_doctors where slug = 'dr-javier-soler-pons'`
    expect(r.public_whatsapp).toBeNull()
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

  it('app_writer escribe datos pero no puede cambiar el esquema', async () => {
    expect(await code(writer`insert into reports (doctor_id, reporter_fingerprint, reason) select id, 'fp', 'Otro' from doctors limit 1`)).toBe('ok')
    expect(await code(writer`drop table reports`)).toBe('42501')
    expect(await code(writer`create table hack (id int)`)).toBe('42501')
  })
})
