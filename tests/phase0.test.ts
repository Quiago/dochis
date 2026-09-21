import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL', 'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN', 'NEXT_PUBLIC_BOT_NUMBER', 'SESSION_SECRET', 'CRON_SECRET',
  'RESEND_API_KEY', 'EMAIL_FROM',
]

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('fase 0', () => {
  it('.env.example declara todas las variables y sin valores secretos', () => {
    const env = readFileSync('.env.example', 'utf8')
    for (const k of REQUIRED) expect(env).toMatch(new RegExp(`^${k}=`, 'm'))
    for (const k of REQUIRED.filter((k) => !k.startsWith('NEXT_PUBLIC_SITE'))) {
      expect(env).toMatch(new RegExp(`^${k}=$`, 'm'))
    }
  })

  it('publicClient falla con mensaje claro si falta la URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    const { publicClient } = await import('@/lib/supabase')
    expect(() => publicClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('serviceClient falla si falta la service role key', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { serviceClient } = await import('@/lib/supabase-server')
    expect(() => serviceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('el cliente con service role está protegido con server-only', () => {
    expect(readFileSync('lib/supabase-server.ts', 'utf8')).toMatch(/^import 'server-only'/m)
    expect(readFileSync('lib/supabase.ts', 'utf8')).not.toMatch(/SERVICE_ROLE/)
  })

  it('crea clientes cuando las variables existen', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
    const { publicClient } = await import('@/lib/supabase')
    const { serviceClient } = await import('@/lib/supabase-server')
    expect(publicClient().from).toBeTypeOf('function')
    expect(serviceClient().from).toBeTypeOf('function')
  })

  it('no usa Tailwind y sí Primer', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps.tailwindcss).toBeUndefined()
    expect(deps['@primer/react']).toBeDefined()
    expect(deps['@primer/primitives']).toBeDefined()
  })
})
