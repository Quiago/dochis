import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const REQUIRED = [
  'DATABASE_URL', 'DATABASE_READER_URL', 'DATABASE_ADMIN_URL', 'NEXT_PUBLIC_SITE_URL', 'AWS_REGION', 'WHATSAPP_REGION', 'ORIGIN_SECRET',
  'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_OTP_TEMPLATE', 'SNS_TOPIC_ARN', 'NEXT_PUBLIC_BOT_NUMBER',
  'OTP_ALLOWED_PREFIXES', 'OTP_DAILY_CAP', 'OTP_PEPPER', 'SESSION_SECRET', 'CRON_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM',
]
const SECRETS = ['OTP_PEPPER', 'SESSION_SECRET', 'CRON_SECRET', 'ORIGIN_SECRET', 'RESEND_API_KEY']

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('configuración', () => {
  it('.env.example declara todas las variables y deja vacíos los secretos', () => {
    const env = readFileSync('.env.example', 'utf8')
    for (const k of REQUIRED) expect(env).toMatch(new RegExp(`^${k}=`, 'm'))
    for (const k of SECRETS) expect(env).toMatch(new RegExp(`^${k}=$`, 'm'))
    expect(env).not.toMatch(/SUPABASE|WHATSAPP_TOKEN|AWS_SECRET_ACCESS_KEY/)
  })

  it('reader() falla con mensaje claro si falta DATABASE_READER_URL', async () => {
    vi.stubEnv('DATABASE_READER_URL', '')
    const { reader } = await import('@/lib/db')
    expect(() => reader()).toThrow(/DATABASE_READER_URL/)
  })

  it('writer() falla con mensaje claro si falta DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', '')
    const { writer } = await import('@/lib/db')
    expect(() => writer()).toThrow(/DATABASE_URL/)
  })

  it('crea conexiones perezosas cuando las variables existen', async () => {
    vi.stubEnv('DATABASE_READER_URL', 'postgres://web_reader:x@localhost:1/db')
    vi.stubEnv('DATABASE_URL', 'postgres://app_writer:x@localhost:1/db')
    const { reader, writer } = await import('@/lib/db')
    expect(reader()).toBeTypeOf('function')
    expect(reader()).toBe(reader())
    expect(writer()).not.toBe(reader())
  })

  it('el acceso a la base está protegido con server-only', () => {
    expect(readFileSync('lib/db.ts', 'utf8')).toMatch(/^import 'server-only'/m)
    expect(readFileSync('lib/doctors.ts', 'utf8')).toMatch(/^import 'server-only'/m)
  })

  it('dependencias: Primer y postgres; sin Tailwind ni Supabase', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps.tailwindcss).toBeUndefined()
    expect(Object.keys(deps).some((d) => d.includes('supabase'))).toBe(false)
    expect(deps.postgres).toBeDefined()
    expect(deps['@primer/react']).toBeDefined()
  })

  it('Next.js genera salida standalone para la EC2', () => {
    expect(readFileSync('next.config.ts', 'utf8')).toMatch(/output:\s*'standalone'/)
  })
})
