import { describe, expect, it } from 'vitest'
import { formValues, parseProfileForm } from '@/lib/profile'
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

  it('enlace opcional a la lista de seguros de la clínica: solo https', () => {
    expect(parseProfileForm(form()).data?.insurance_url).toBeNull()
    expect(parseProfileForm(form({ insurance_url: ' https://www.mediclinic.ae/redes.pdf ' })).data?.insurance_url).toBe('https://www.mediclinic.ae/redes.pdf')
    expect(parseProfileForm(form({ insurance_url: 'http://inseguro.com' })).errors?.insurance_url).toMatch(/https/)
    expect(parseProfileForm(form({ insurance_url: 'javascript:alert(1)' })).errors?.insurance_url).toBeTruthy()
    expect(parseProfileForm(form({ insurance_url: 'https://x.com/' + 'a'.repeat(400) })).errors?.insurance_url).toBeTruthy()
  })

  it('limita longitudes para evitar abusos', () => {
    expect(parseProfileForm(form({ full_name: 'x'.repeat(200) })).errors?.full_name).toBeTruthy()
    expect(parseProfileForm(form({ insurances: Array.from({ length: 40 }, (_, i) => `Seguro ${i}`).join(',') })).errors?.insurances).toBeTruthy()
  })

  it('publica la licencia por defecto y la oculta si se desmarca la casilla', () => {
    expect(parseProfileForm(form({ show_license: 'on' })).data?.show_license).toBe(true)
    const fd = form(); fd.delete('show_license')
    expect(parseProfileForm(fd).data?.show_license).toBe(false)
    expect(parseProfileForm(fd).errors).toBeUndefined()  // ocultarla no es un error: la licencia sigue siendo obligatoria
  })

  it('acepta las redes de la lista y una sola web propia', () => {
    const links = ['https://instagram.com/dra.lucia', 'https://www.linkedin.com/in/lucia', 'https://clinicapalmera.ae'].join('\n')
    expect(parseProfileForm(form({ links })).data?.links).toHaveLength(3)
  })

  it('rechaza dominios que imitan a los de la lista', () => {
    for (const bad of ['https://instagram.com.evil.io/x', 'https://notinstagram.com/x', 'https://bit.ly/x', 'https://linktr.ee/x']) {
      const r = parseProfileForm(form({ links: ['https://clinicapalmera.ae', bad].join('\n') }))
      expect(r.errors?.links, bad).toBeTruthy()
    }
  })

  it('solo admite una web libre, y como mucho cinco enlaces', () => {
    const dos = ['https://clinicapalmera.ae', 'https://otraclinica.ae'].join('\n')
    expect(parseProfileForm(form({ links: dos })).errors?.links).toMatch(/una página web/)
    const seis = Array.from({ length: 6 }, (_, i) => `https://instagram.com/c${i}`).join('\n')
    expect(parseProfileForm(form({ links: seis })).errors?.links).toMatch(/cinco/)
  })

  it('limpia el correo público y rechaza el que no lo es', () => {
    expect(parseProfileForm(form({ public_email: '  MAILTO:Lucia@Clinica.AE ' })).data?.public_email).toBe('lucia@clinica.ae')
    expect(parseProfileForm(form({ public_email: 'lucia arroba clinica' })).errors?.public_email).toBeTruthy()
  })

  it('exige las dos horas de cada franja y que la apertura sea antes que el cierre', () => {
    const ok = parseProfileForm(form({ hours_weekday_open: '09:00', hours_weekday_close: '17:00' }))
    expect(ok.errors).toBeUndefined()
    expect(ok.data?.hours_weekday_open).toBe('09:00')
    expect(parseProfileForm(form({ hours_weekday_open: '09:00' })).errors?.hours_weekday).toMatch(/las dos horas/)
    expect(parseProfileForm(form({ hours_weekday_open: '22:00', hours_weekday_close: '02:00' })).errors?.hours_weekday).toMatch(/antes/)
  })

  it('rechaza un enlace individual demasiado largo', () => {
    const long = 'https://clinicapalmera.ae/' + 'a'.repeat(300)
    expect(parseProfileForm(form({ links: long })).errors?.links).toMatch(/300 caracteres/)
  })
})

describe('formValues', () => {
  it('conserva los campos de texto, casillas y varios valores tal como se enviaron', () => {
    const fd = form({
      show_license: 'on', show_whatsapp: 'on', public_whatsapp: '050 123 4567', public_email: 'lucia@clinica.ae',
      links: 'https://clinicapalmera.ae\nhttps://instagram.com/dra.lucia',
      hours_weekday_open: '09:00', hours_weekday_close: '17:00',
    })
    const v = formValues(fd)
    expect(v.full_name).toBe('  Dra. Lucía Márquez ')
    expect(v.languages).toEqual(['Español', 'Inglés'])
    expect(v.other_languages).toBe('Catalán, ')
    expect(v.show_license).toBe(true)
    expect(v.show_whatsapp).toBe(true)
    expect(v.consent).toBe(true)
    expect(v.links).toBe('https://clinicapalmera.ae\nhttps://instagram.com/dra.lucia')
    expect(v.hours_weekday_open).toBe('09:00')
    expect(v.hours_weekday_close).toBe('17:00')
  })

  it('marca las casillas como false cuando no se envían', () => {
    const fd = form(); fd.delete('consent'); fd.delete('show_license')
    const v = formValues(fd)
    expect(v.consent).toBe(false)
    expect(v.show_license).toBe(false)
  })

  it('devuelve cadenas vacías para los campos opcionales ausentes', () => {
    const v = formValues(form())
    expect(v.public_email).toBe('')
    expect(v.links).toBe('')
    expect(v.hours_weekend_open).toBe('')
  })
})

describe('contacto del directorio (.vcf)', () => {
  it('genera una vCard con nombre, WhatsApp y correo', () => {
    const v = vcard({ name: 'Directorio Sanitarios en español', phone: '971500000000', email: 'dochispanic@gmail.com', url: 'https://x.test' })
    expect(v).toMatch(/^BEGIN:VCARD\r\nVERSION:3.0\r\n/)
    expect(v).toContain('FN:Directorio Sanitarios en español')
    expect(v).toContain('TEL;TYPE=CELL:+971500000000')
    expect(v).toContain('EMAIL:dochispanic@gmail.com')
    expect(v.endsWith('END:VCARD\r\n')).toBe(true)
  })

  it('omite el teléfono si no hay número del bot', () => {
    expect(vcard({ name: 'D', phone: '', email: 'a@b.co', url: 'https://x.test' })).not.toContain('TEL')
  })
})
