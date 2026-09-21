// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import Providers from '@/app/providers'
import DoctorRow from '@/components/DoctorRow'
import type { PublicDoctor } from '@/lib/directory'

afterEach(cleanup)

const NOW = new Date('2026-09-21T12:00:00Z')
const base: PublicDoctor = {
  id: '1', slug: 'dra-lucia', full_name: 'Dra. Lucía', specialty: 'Pediatría', clinic: 'Palmera Kids', area: 'Jumeirah',
  emirate: 'Dubái', languages: ['Español'], insurances: ['Daman'], regulator: 'DHA', public_whatsapp: '+971500000001',
  status: 'verified', last_confirmed_at: '2026-09-09T12:00:00Z',
}
const row = (d: Partial<PublicDoctor>) =>
  render(<Providers><ul><DoctorRow d={{ ...base, ...d }} now={NOW} /></ul></Providers>)

describe('DoctorRow', () => {
  it('muestra nombre enlazado al perfil, estado, topics y licencia', () => {
    row({})
    expect(screen.getByRole('link', { name: 'Dra. Lucía' }).getAttribute('href')).toBe('/medico/dra-lucia')
    expect(screen.getByText('Confirmado')).toBeTruthy()
    expect(screen.getByText('Daman')).toBeTruthy()
    expect(screen.getByText(/Licencia DHA/)).toBeTruthy()
  })

  it('WhatsApp solo con public_whatsapp; si no, contacto por clínica', () => {
    row({})
    expect(screen.getByRole('link', { name: 'Escribir por WhatsApp' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/971500000001\?text=/)
    cleanup()
    row({ public_whatsapp: null })
    expect(screen.queryByText('Escribir por WhatsApp')).toBeNull()
    expect(screen.getByText('Contacto a través de su clínica')).toBeTruthy()
  })

  it('perfil sin reclamar: etiqueta gris y botón para reclamarlo', () => {
    row({ status: 'unclaimed', last_confirmed_at: null, regulator: null, public_whatsapp: null, languages: [], insurances: [] })
    expect(screen.getByText('Sin confirmar')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Reclama tu perfil/ }).getAttribute('href')).toBe('/entrar?medico=dra-lucia')
    expect(screen.queryByText(/Licencia/)).toBeNull()
  })
})

describe('layout', () => {
  it('en español con tema claro/oscuro automático y sin marca de GitHub', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8')
    expect(layout).toMatch(/lang="es"/)
    expect(layout).toMatch(/data-color-mode="auto"/)
    expect(layout).toMatch(/data-dark-theme="dark"/)
    expect(layout.toLowerCase()).not.toMatch(/github/)
  })
})
