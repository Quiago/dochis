// Revisor automático de perfiles: reglas propias + Bedrock (simulado). Requiere `npm run db:up` para los duplicados.
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { licenseFormatIssue, llmIssues, reviewProfile } from '@/lib/review'
import type { ProfileData } from '@/lib/profile'
import { freshDatabase } from './pg'

const data = (over: Partial<ProfileData> = {}): ProfileData => ({
  full_name: 'Dra. Nueva Pérez', specialty: 'Pediatría', clinic: 'Clínica Nueva', area: null, emirate: 'Dubái',
  languages: ['Español'], insurances: [], regulator: 'DHA', license_number: '12345678', public_whatsapp: null, ...over,
})

describe('formato de licencia', () => {
  it('acepta números y códigos habituales', () => {
    for (const l of ['12345678', 'DHA-10001', 'GD12345', 'DOH/2023/5567']) expect(licenseFormatIssue(l), l).toBeNull()
  })
  it('marca lo que no parece una licencia', () => {
    for (const l of ['abc', 'no tengo', '12', 'x'.repeat(30)]) expect(licenseFormatIssue(l), l).toMatch(/licencia/)
  })
})

describe('revisión con Bedrock (simulada)', () => {
  it('devuelve los problemas que el modelo marca', async () => {
    const invoke = vi.fn().mockResolvedValue('{"problemas": ["La especialidad no es sanitaria"]}')
    expect(await llmIssues(data({ specialty: 'Venta de coches' }), invoke)).toEqual(['La especialidad no es sanitaria'])
    expect(invoke.mock.calls[0][0]).toContain('Venta de coches')
  })
  it('nunca envía el teléfono al modelo', async () => {
    const invoke = vi.fn().mockResolvedValue('{"problemas": []}')
    await llmIssues(data({ public_whatsapp: '+971501234567' }), invoke)
    expect(invoke.mock.calls[0][0]).not.toContain('971501234567')
  })

  it('tolera texto alrededor del JSON y respuestas vacías', async () => {
    expect(await llmIssues(data(), vi.fn().mockResolvedValue('Claro: {"problemas": []} listo'))).toEqual([])
  })
  it('si el modelo falla o responde basura, no bloquea (sin problemas)', async () => {
    expect(await llmIssues(data(), vi.fn().mockRejectedValue(new Error('throttled')))).toEqual([])
    expect(await llmIssues(data(), vi.fn().mockResolvedValue('no es json'))).toEqual([])
  })
  it('sin modelo configurado no llama a nada', async () => {
    vi.stubEnv('BEDROCK_MODEL_ID', '')
    expect(await llmIssues(data())).toEqual([])
    vi.unstubAllEnvs()
  })
})

const db = await freshDatabase('dochis_test_review', { seed: true })
let sql: postgres.Sql
beforeAll(() => { if (db) sql = postgres(db.writerUrl, { max: 1, onnotice: () => {} }) })
afterAll(async () => { await sql?.end() })

describe.skipIf(!db)('revisión completa', () => {
  const noLlm = { invoke: vi.fn().mockResolvedValue('{"problemas": []}') }

  it('un perfil normal pasa', async () => {
    expect(await reviewProfile(sql, data(), {}, noLlm)).toEqual({ ok: true, issues: [] })
  })

  it('marca una licencia ya usada por otro médico del mismo regulador', async () => {
    const r = await reviewProfile(sql, data({ license_number: 'DHA-10001' }), {}, noLlm)
    expect(r.ok).toBe(false)
    expect(r.issues.join()).toMatch(/licencia ya está en otro perfil/i)
  })

  it('marca un nombre igual a un médico ya publicado', async () => {
    const r = await reviewProfile(sql, data({ full_name: 'dra. lucía márquez ortega' }), {}, noLlm)
    expect(r.issues.join()).toMatch(/ya hay un perfil publicado/i)
  })

  it('no se marca a sí mismo al editar su propio perfil', async () => {
    const [lucia] = await sql`select id, license_number from doctors where slug = 'dra-lucia-marquez-ortega'`
    const r = await reviewProfile(sql, data({ full_name: 'Dra. Lucía Márquez Ortega', license_number: lucia.license_number }), { excludeId: lucia.id }, noLlm)
    expect(r).toEqual({ ok: true, issues: [] })
  })

  it('suma los problemas del modelo', async () => {
    const r = await reviewProfile(sql, data(), {}, { invoke: vi.fn().mockResolvedValue('{"problemas": ["Texto ofensivo en la clínica"]}') })
    expect(r).toEqual({ ok: false, issues: ['Texto ofensivo en la clínica'] })
  })
})
