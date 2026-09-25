// Login por código enviado al correo (SMTP). Requiere `npm run db:up` (Postgres + Mailpit).
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { consumeChallenge, createChallenge, verifyTypedCode } from '@/lib/auth'
import { normalizeEmail, sendLoginCode } from '@/lib/email'
import { createSessionToken, readSessionToken } from '@/lib/session'
import { freshDatabase } from './pg'

const db = await freshDatabase('dochis_test_email', { seed: false })
const MAILPIT = 'http://localhost:8025'
const mailpitUp = await fetch(`${MAILPIT}/api/v1/messages`).then((r) => r.ok, () => false)

let sql: postgres.Sql
const PEPPER = 'test-pepper'
const EMAIL = 'dra.lucia@example.com'
const T0 = new Date('2026-09-21T10:00:00Z')
const at = (min: number) => new Date(T0.getTime() + min * 60_000)
const create = (over: Partial<Parameters<typeof createChallenge>[1]> = {}) =>
  createChallenge(sql, { email: EMAIL, ip: '203.0.113.7', pepper: PEPPER, dailyCap: 1000, now: T0, ...over })

beforeAll(() => { if (db) sql = postgres(db.writerUrl, { max: 2, onnotice: () => {} }) })
beforeEach(async () => { if (db) await sql`delete from login_challenges` })
afterAll(async () => { await sql?.end() })

describe('correos', () => {
  it('normaliza y valida direcciones', () => {
    expect(normalizeEmail('  Dra.Lucia@Example.COM ')).toBe('dra.lucia@example.com')
    expect(normalizeEmail('sin-arroba')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('a b@c.com')).toBeNull()
    expect(normalizeEmail('x'.repeat(250) + '@c.com')).toBeNull()
  })

  it('la sesión puede identificarse por correo', async () => {
    vi.stubEnv('SESSION_SECRET', 'a'.repeat(32))
    expect(await readSessionToken(await createSessionToken(EMAIL))).toEqual({ email: EMAIL })
    vi.unstubAllEnvs()
  })
})

describe.skipIf(!db)('login por código de correo', () => {
  it('crea el challenge con el correo y sin teléfono', async () => {
    const r = await create()
    if (!('id' in r)) throw new Error(r.error)
    const [row] = await sql`select phone_e164, email, code_hash from login_challenges where id = ${r.id}`
    expect(row).toMatchObject({ phone_e164: null, email: EMAIL })
    expect(row.code_hash).not.toContain(r.code)
  })

  it('el código tecleado correcto verifica y la sesión se entrega una vez', async () => {
    const r = await create()
    if (!('id' in r)) throw new Error(r.error)
    expect(await verifyTypedCode(sql, { id: r.id, code: r.code, pepper: PEPPER, now: at(2) })).toBe('verified')
    expect(await consumeChallenge(sql, r.id)).toBe(EMAIL)
    expect(await consumeChallenge(sql, r.id)).toBeNull()
    expect(await verifyTypedCode(sql, { id: r.id, code: r.code, pepper: PEPPER, now: at(2) })).toBe('expired')
  })

  it('5 códigos erróneos invalidan el challenge', async () => {
    const r = await create()
    if (!('id' in r)) throw new Error(r.error)
    const wrong = r.code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) expect(await verifyTypedCode(sql, { id: r.id, code: wrong, pepper: PEPPER, now: at(1) })).toBe('wrong_code')
    expect(await verifyTypedCode(sql, { id: r.id, code: r.code, pepper: PEPPER, now: at(1) })).toBe('expired')
  })

  it('caduca a los 10 minutos y rechaza ids inválidos', async () => {
    const r = await create()
    if (!('id' in r)) throw new Error(r.error)
    expect(await verifyTypedCode(sql, { id: r.id, code: r.code, pepper: PEPPER, now: at(11) })).toBe('expired')
    expect(await verifyTypedCode(sql, { id: 'no-es-un-uuid', code: r.code, pepper: PEPPER, now: at(1) })).toBe('expired')
  })

  it('un challenge de teléfono no se puede verificar tecleando el código', async () => {
    const r = await createChallenge(sql, { phone: '+971501234567', ip: null, pepper: PEPPER, dailyCap: 1000, now: T0 })
    if (!('id' in r)) throw new Error(r.error)
    expect(await verifyTypedCode(sql, { id: r.id, code: r.code, pepper: PEPPER, now: at(1) })).toBe('expired')
  })

  it('máximo 5 códigos por correo por hora (sin importar mayúsculas)', async () => {
    for (let i = 0; i < 5; i++) expect(await create({ ip: `198.51.100.${i}` })).toHaveProperty('id')
    expect(await create({ ip: '198.51.100.99' })).toEqual({ error: 'rate_limited_identity' })
    expect(await create({ email: 'otra@example.com', ip: '198.51.100.99' })).toHaveProperty('id')
  })
})

describe.skipIf(!mailpitUp)('envío por SMTP', () => {
  it('manda el código al destinatario con asunto y texto en español', async () => {
    vi.stubEnv('SMTP_URL', 'smtp://localhost:1025')
    vi.stubEnv('EMAIL_FROM', 'Sanitarios en español <directorio@example.com>')
    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' })
    await sendLoginCode('dra.lucia@example.com', '482913')
    const list = await fetch(`${MAILPIT}/api/v1/messages`).then((r) => r.json())
    expect(list.messages).toHaveLength(1)
    const msg = await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`).then((r) => r.json())
    expect(msg.To[0].Address).toBe('dra.lucia@example.com')
    expect(msg.Subject).toContain('482913')
    expect(msg.Text).toMatch(/10 minutos/)
    vi.unstubAllEnvs()
  })
})
