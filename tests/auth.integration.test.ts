// Login con "OTP inverso" contra Postgres real (rol app_writer). Requiere `npm run db:up`.
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { challengeStatus, consumeChallenge, createChallenge, verifyFromWhatsApp } from '@/lib/auth'
import { freshDatabase } from './pg'

const db = await freshDatabase('dochis_test_auth', { seed: false })
let sql: postgres.Sql
const PEPPER = 'test-pepper'
const PHONE = '+971501234567'
const T0 = new Date('2026-09-21T10:00:00Z')
const at = (min: number) => new Date(T0.getTime() + min * 60_000)
const create = (over: Partial<Parameters<typeof createChallenge>[1]> = {}) =>
  createChallenge(sql, { phone: PHONE, ip: '203.0.113.7', pepper: PEPPER, dailyCap: 1000, now: T0, ...over })

beforeAll(() => { if (db) sql = postgres(db.writerUrl, { max: 2, onnotice: () => {} }) })
beforeEach(async () => { if (db) await sql`delete from login_challenges` })
afterAll(async () => { await sql?.end() })

describe.skipIf(!db)('login por WhatsApp (OTP inverso)', () => {
  it('crea un challenge pendiente y guarda el código solo como hash', async () => {
    const r = await create()
    if (!('id' in r)) throw new Error(r.error)
    expect(r.code).toMatch(/^\d{6}$/)
    const [row] = await sql`select * from login_challenges where id = ${r.id}`
    expect(row.status).toBe('pending')
    expect(row.code_hash).not.toContain(r.code)
    expect(await challengeStatus(sql, r.id, T0)).toBe('pending')
  })

  it('verifica cuando el remitente y el código coinciden, y entrega la sesión una sola vez', async () => {
    const r = await create()
    if (!('id' in r)) throw new Error(r.error)
    expect(await verifyFromWhatsApp(sql, { from: PHONE, code: r.code, pepper: PEPPER, now: at(1) })).toBe('verified')
    expect(await challengeStatus(sql, r.id, at(1))).toBe('verified')
    expect(await consumeChallenge(sql, r.id)).toBe(PHONE)
    expect(await consumeChallenge(sql, r.id)).toBeNull()
  })

  it('no verifica si el código llega desde otro número', async () => {
    const r = await create()
    if (!('id' in r)) throw new Error(r.error)
    expect(await verifyFromWhatsApp(sql, { from: '+971509999999', code: r.code, pepper: PEPPER, now: at(1) })).toBe('no_challenge')
    expect(await challengeStatus(sql, r.id, at(1))).toBe('pending')
    expect(await consumeChallenge(sql, r.id)).toBeNull()
  })

  it('expira a los 10 minutos', async () => {
    const r = await create()
    if (!('id' in r)) throw new Error(r.error)
    expect(await verifyFromWhatsApp(sql, { from: PHONE, code: r.code, pepper: PEPPER, now: at(11) })).toBe('no_challenge')
    expect(await challengeStatus(sql, r.id, at(11))).toBe('expired')
  })

  it('5 códigos erróneos invalidan el challenge', async () => {
    const r = await create()
    if (!('id' in r)) throw new Error(r.error)
    const wrong = r.code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) {
      expect(await verifyFromWhatsApp(sql, { from: PHONE, code: wrong, pepper: PEPPER, now: at(1) })).toBe('wrong_code')
    }
    expect(await verifyFromWhatsApp(sql, { from: PHONE, code: r.code, pepper: PEPPER, now: at(1) })).toBe('no_challenge')
    expect(await challengeStatus(sql, r.id, at(1))).toBe('expired')
  })

  it('máximo 5 challenges por número por hora', async () => {
    for (let i = 0; i < 5; i++) expect(await create({ ip: `198.51.100.${i}` })).toHaveProperty('id')
    expect(await create({ ip: '198.51.100.99' })).toEqual({ error: 'rate_limited_identity' })
    expect(await create({ ip: '198.51.100.99', now: at(61) })).toHaveProperty('id')
  })

  it('máximo 20 challenges por IP por hora y tope diario global', async () => {
    for (let i = 0; i < 20; i++) expect(await create({ phone: `+97150000${String(i).padStart(4, '0')}` })).toHaveProperty('id')
    expect(await create({ phone: '+971509990000' })).toEqual({ error: 'rate_limited_ip' })
    expect(await create({ phone: '+971509990001', ip: '192.0.2.1', dailyCap: 21 })).toHaveProperty('id')
    expect(await create({ phone: '+971509990002', ip: '192.0.2.2', dailyCap: 21 })).toEqual({ error: 'daily_cap' })
  })

  it('un nuevo challenge invalida los pendientes anteriores del mismo número', async () => {
    const a = await create()
    const b = await create({ now: at(1) })
    if (!('id' in a) || !('id' in b)) throw new Error('rate limited')
    expect(await verifyFromWhatsApp(sql, { from: PHONE, code: a.code, pepper: PEPPER, now: at(2) })).not.toBe('verified')
    expect(await verifyFromWhatsApp(sql, { from: PHONE, code: b.code, pepper: PEPPER, now: at(2) })).toBe('verified')
  })
})
