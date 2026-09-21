import { describe, expect, it } from 'vitest'
import { parseProfileForm } from '@/lib/profile'
import { vcard } from '@/lib/vcard'

const form = (over: Record<string, string | string[]> = {}) => {
  const fd = new FormData()
  const base: Record<string, string | string[]> = {
    full_name: '  Dra. Lucía Márquez ', specialty: 'Pediatría', clinic: 'Clínica Palmera', area: 'Jumeirah',
    emirate: 'Dubái', languages: ['Español', 'Inglés'], other_languages: 'Catalán, ', insurances: 'Daman, AXA,, ',
    regulator: 'DHA', license_number: ' DHA-12345 ', consent: 'on', ...over,
  }
  for (const [k, v] of Object.entries(base)) for (const x of [v].flat()) fd.append(k, x)
  return fd
}

describe('formulario de perfil', () => {
  it('limpia y normaliza los datos válidos', () => {
    const r = parseProfileForm(form())
    expect(r.errors).toBeUndefined()
    expect(r.data).toMatchObject({
      full_name: 'Dra. Lucía Márquez', languages: ['Español', 'Inglés', 'Catalán'], insurances: ['Daman', 'AXA'],
      license_number: 'DHA-12345', regulator: 'DHA', emirate: 'Dubái', public_whatsapp: null,
    })
  })

  it('exige los campos obligatorios', () => {
    const r = parseProfileForm(form({ full_name: ' ', clinic: '', license_number: '' }))
    expect(Object.keys(r.errors ?? {})).toEqual(expect.arrayContaining(['full_name', 'clinic', 'license_number']))
  })

  it('exige el consentimiento para publicar', () => {
    const fd = form(); fd.delete('consent')
    expect(parseProfileForm(fd).errors?.consent).toMatch(/aceptar/)
  })

  it('solo acepta emiratos y reguladores conocidos, y al menos un idioma', () => {
    const r = parseProfileForm(form({ emirate: 'Madrid', regulator: 'XYZ', languages: [], other_languages: '' }))
    expect(Object.keys(r.errors ?? {})).toEqual(expect.arrayContaining(['emirate', 'regulator', 'languages']))
  })

  it('WhatsApp público solo si se marca la casilla, y normalizado a E.164', () => {
    expect(parseProfileForm(form({ public_whatsapp: '050 123 4567' })).data?.public_whatsapp).toBeNull()
    expect(parseProfileForm(form({ public_whatsapp: '050 123 4567', show_whatsapp: 'on' })).data?.public_whatsapp).toBe('+971501234567')
    expect(parseProfileForm(form({ public_whatsapp: '123', show_whatsapp: 'on' })).errors?.public_whatsapp).toBeTruthy()
  })

  it('limita longitudes para evitar abusos', () => {
    expect(parseProfileForm(form({ full_name: 'x'.repeat(200) })).errors?.full_name).toBeTruthy()
    expect(parseProfileForm(form({ insurances: Array.from({ length: 40 }, (_, i) => `Seguro ${i}`).join(',') })).errors?.insurances).toBeTruthy()
  })
})

describe('contacto del directorio (.vcf)', () => {
  it('genera una vCard con nombre, WhatsApp y correo', () => {
    const v = vcard({ name: 'Directorio Médicos en español', phone: '971500000000', email: 'dochispanic@gmail.com', url: 'https://x.test' })
    expect(v).toMatch(/^BEGIN:VCARD\r\nVERSION:3.0\r\n/)
    expect(v).toContain('FN:Directorio Médicos en español')
    expect(v).toContain('TEL;TYPE=CELL:+971500000000')
    expect(v).toContain('EMAIL:dochispanic@gmail.com')
    expect(v.endsWith('END:VCARD\r\n')).toBe(true)
  })

  it('omite el teléfono si no hay número del bot', () => {
    expect(vcard({ name: 'D', phone: '', email: 'a@b.co', url: 'https://x.test' })).not.toContain('TEL')
  })
})
