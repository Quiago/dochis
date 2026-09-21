// Importación contra Postgres real. Requiere `npm run db:up`.
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { importDoctors, type ImportDoctor } from '@/lib/import'
import { freshDatabase } from './pg'

const db = await freshDatabase('dochis_test_import', { seed: true })
let sql: postgres.Sql
let reader: postgres.Sql
const d = (over: Partial<ImportDoctor>): ImportDoctor => ({
  full_name: 'Inmaculada Prueba', specialty: 'Alergología', clinic: 'Cleveland Clinic', emirate: 'Abu Dabi',
  phone_e164: '+971581112233', email: 'inma@example.org', line: 2, ...over,
})

beforeAll(() => {
  if (!db) return
  sql = postgres(db.writerUrl, { max: 2, onnotice: () => {} })
  reader = postgres(db.readerUrl, { max: 1, onnotice: () => {} })
})
afterAll(async () => { await sql?.end(); await reader?.end() })

describe.skipIf(!db)('importación de la lista del grupo', () => {
  it('crea perfiles sin reclamar que muestran solo nombre, especialidad y centro', async () => {
    const r = await importDoctors(sql, [d({})])
    expect(r.inserted).toEqual(['inmaculada-prueba'])
    const [pub] = await reader`select * from public_doctors where slug = 'inmaculada-prueba'`
    expect(pub).toMatchObject({ status: 'unclaimed', full_name: 'Inmaculada Prueba', specialty: 'Alergología', clinic: 'Cleveland Clinic', languages: [], public_whatsapp: null })
    const [priv] = await sql`select phone_e164, email from doctors where slug = 'inmaculada-prueba'`
    expect(priv).toEqual({ phone_e164: '+971581112233', email: 'inma@example.org' })
  })

  it('es idempotente: volver a importar no duplica', async () => {
    const r = await importDoctors(sql, [d({ full_name: 'INMACULADA PRUEBA' })])
    expect(r.inserted).toEqual([])
    expect(r.skipped[0].reason).toBe('Ya existe en el directorio')
  })

  it('no roba el teléfono ni el correo de otro médico existente', async () => {
    const r = await importDoctors(sql, [d({ full_name: 'Otro Nombre', phone_e164: '+971500000001', email: 'lucia@example.com' })])
    expect(r.inserted).toEqual(['otro-nombre'])
    const [row] = await sql`select phone_e164, email from doctors where slug = 'otro-nombre'`
    expect(row).toEqual({ phone_e164: null, email: null })
  })

  it('el médico importado puede reclamar su perfil entrando con ese correo', async () => {
    const { findDoctorByIdentity } = await import('@/lib/onboarding')
    expect((await findDoctorByIdentity(sql, 'INMA@example.org'))?.slug).toBe('inmaculada-prueba')
  })
})
