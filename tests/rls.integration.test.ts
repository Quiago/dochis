// Criterio de "listo" de la Fase 1: anon no puede leer teléfono, correo ni licencia.
// Requiere Supabase local: `npx supabase start && npx supabase db reset`.
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

function localSupabase(): { url: string; anon: string } | null {
  try {
    const s = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString())
    return s.API_URL && s.ANON_KEY ? { url: s.API_URL, anon: s.ANON_KEY } : null
  } catch {
    return null
  }
}

const local = localSupabase()
const anon = local && createClient(local.url, local.anon, { auth: { persistSession: false } })
const SECRET_COLUMNS = ['phone_e164', 'email', 'license_number', 'consent_at', 'created_at']

describe.skipIf(!local)('RLS con la clave anon', () => {
  it('no puede leer la tabla doctors', async () => {
    const { data, error } = await anon!.from('doctors').select('*')
    expect(data ?? []).toHaveLength(0)
    expect(error?.code).toBe('42501') // permission denied
  })

  it('no puede pedir columnas privadas a la vista pública', async () => {
    for (const col of ['phone_e164', 'email', 'license_number']) {
      const { error } = await anon!.from('public_doctors').select(col)
      expect(error, col).not.toBeNull()
    }
  })

  it('la vista pública no expone columnas privadas ni perfiles ocultos o pendientes', async () => {
    const { data, error } = await anon!.from('public_doctors').select('*')
    expect(error).toBeNull()
    expect(data!.length).toBe(14)
    for (const row of data!) for (const col of SECRET_COLUMNS) expect(row).not.toHaveProperty(col)
    const slugs = data!.map((r) => r.slug)
    expect(slugs).not.toContain('dr-oculto-pendiente')
    expect(slugs).not.toContain('dra-oculta-hidden')
    const json = JSON.stringify(data)
    expect(json).not.toMatch(/example\.com|DHA-|DOH-|MOH-/)
  })

  it('perfiles sin reclamar solo muestran nombre, especialidad, clínica, zona y emirato', async () => {
    const { data } = await anon!.from('public_doctors').select('*').eq('status', 'unclaimed')
    expect(data!.length).toBe(2)
    for (const row of data!) {
      expect(row).toMatchObject({ languages: [], insurances: [], regulator: null, public_whatsapp: null, last_confirmed_at: null })
      expect(row.full_name && row.specialty && row.clinic && row.emirate).toBeTruthy()
    }
  })

  it('WhatsApp público solo aparece con consentimiento (wa=false queda en null)', async () => {
    const { data } = await anon!.from('public_doctors').select('slug, public_whatsapp').eq('slug', 'dr-javier-soler-pons').single()
    expect(data!.public_whatsapp).toBeNull()
  })

  it('no puede leer tablas internas', async () => {
    for (const t of ['login_challenges', 'bot_sessions', 'reports', 'verification_requests', 'admins', 'confirmations']) {
      const { data, error } = await anon!.from(t).select('*')
      expect(error?.code, t).toBe('42501')
      expect(data ?? [], t).toHaveLength(0)
    }
  })

  it('no puede escribir', async () => {
    const ins = await anon!.from('doctors').insert({ slug: 'hack', full_name: 'Hack', specialty: 'x', clinic: 'x', emirate: 'x' })
    expect(ins.error).not.toBeNull()
    const upd = await anon!.from('public_doctors').update({ full_name: 'Hack' }).eq('slug', 'dr-omar-haddad')
    expect(upd.error).not.toBeNull()
  })

  it('el historial público solo incluye médicos visibles y reclamados', async () => {
    const { data: all } = await anon!.from('public_confirmations').select('doctor_id')
    const { data: visible } = await anon!.from('public_doctors').select('id').in('status', ['verified', 'stale'])
    const ids = new Set(visible!.map((r) => r.id))
    expect(all!.length).toBeGreaterThan(0)
    for (const r of all!) expect(ids.has(r.doctor_id)).toBe(true)
  })
})
