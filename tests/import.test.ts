import { describe, expect, it } from 'vitest'
import { cleanClinic, extractEmail, extractMobile, normalizeEmirate, normalizeSpecialty, parseCsv, prepareImport } from '@/lib/import'

describe('CSV', () => {
  it('respeta comillas, comas y saltos de línea dentro de campos, y quita el BOM', () => {
    const rows = parseCsv('\uFEFFa,b,c\n1,"dos, y tres","x\ny"\n4,5,6\n')
    expect(rows).toEqual([['a', 'b', 'c'], ['1', 'dos, y tres', 'x\ny'], ['4', '5', '6']])
  })

  it('comillas escapadas y CRLF', () => {
    expect(parseCsv('a,"di ""hola"""\r\nb,c\r\n')).toEqual([['a', 'di "hola"'], ['b', 'c']])
  })
})

describe('especialidades', () => {
  it.each([
    ['Alergóloga (adultos y niños) 🤧', 'Alergología'],
    ['Cardiologia/Electrofisiologia ❤️', 'Cardiología'],
    ['Consultant Neurointerventional Radiologist 🧠', 'Radiología'],
    ['Consultant Urologist 💧', 'Urología'],
    ['ORTODONCISTA 🦷', 'Ortodoncia'],
    ['Orthodontist 🦷', 'Ortodoncia'],
    ['Odontología/Ortodoncia 🦷', 'Ortodoncia'],
    ['Odontología estética - familiar 🦷', 'Odontología'],
    ['Cirujano Oral 🦷', 'Cirugía oral y maxilofacial'],
    ['Cirugía Plastica y Maxilofacial ✨', 'Cirugía plástica'],
    ['Cirugía general y Digestiva ⚕️', 'Cirugía general y digestiva'],
    ['Pediatria& Pediatria Intensiva 🧸', 'Pediatría'],
    ['Medicina Intensiva 🏥', 'Medicina intensiva'],
    ['Intensivista 🏥', 'Medicina intensiva'],
    ['Medicina de Familia/Medicina Estética 👨‍👩‍👧‍👦', 'Medicina familiar'],
    ['Medicina general / Integrativa 🩺', 'Medicina familiar'],
    ['Medicina Estética ✨', 'Medicina estética'],
    ['Traumatología: Hombro. Sports 💪', 'Traumatología'],
    ['Rehabilitacion. Mano y extremidad superior 🦾', 'Traumatología'],
    ['Medicina deportiva 🏅', 'Medicina deportiva'],
    ['Neuropsicología y Psicología Clínica 🧠', 'Psicología'],
    ['Psiquiatría - Somnología 🛋️', 'Psiquiatría'],
    ['Neurologia 🧠', 'Neurología'],
    ['Hemato-oncología 🩸', 'Hematología'],
    ['Salud hormonal y fertilidad 👶', 'Fertilidad'],
    ['Ginecología. Salud Hormonal Femenina 🤰', 'Ginecología y obstetricia'],
    ['Obstetricia - Medicina Materno Fetal 🤰', 'Ginecología y obstetricia'],
    ['Enfermeria UCI 💉', 'Enfermería'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeSpecialty(raw)).toEqual({ value: expected, mapped: true })
  })

  it('lo que no reconoce queda limpio (sin emojis) y marcado para revisar', () => {
    expect(normalizeSpecialty('  Algo Nuevo 🧪 ')).toEqual({ value: 'Algo Nuevo', mapped: false })
  })
})

describe('emiratos', () => {
  it.each([
    ['Dubai', 'Dubái'], ['DUBAI', 'Dubái'], ['Duabi', 'Dubái'], ['Dubai - Sharja', 'Dubái'], ['Dubai- Abu Dabhi', 'Dubái'],
    ['Abu Dhabi', 'Abu Dabi'], ['Al Ain', 'Abu Dabi'], ['Abu Dhabi / Al Ain', 'Abu Dabi'], ['Abu Dhabi/Dubai', 'Abu Dabi'],
    ['Ahman', 'Ajmán'], ['Sharjah', 'Sharjah'], ['Ras Al Khaima', 'Ras al-Jaima'],
  ])('%s → %s', (raw, expected) => expect(normalizeEmirate(raw)).toBe(expected))

  it('fuera de EAU o vacío → null', () => {
    for (const raw of ['Saudí Arabia', 'Kuwait', 'Doha (Qatar)', 'Juaneda', '']) expect(normalizeEmirate(raw)).toBeNull()
  })
})

describe('teléfono de acceso: solo móviles de EAU', () => {
  it.each([
    ['971586234994', '+971586234994'],
    ['+971 50 123 4567', '+971501234567'],
    ['0443803000/0523834743 (personal)', '+971523834743'],
    ['508408371/0565552504 (wa)', '+971508408371'],
  ])('%s → %s', (raw, expected) => expect(extractMobile(raw)).toBe(expected))

  it('fijos, centralitas, extranjeros y webs → null', () => {
    for (const raw of ['9718001999', '97142198631 L-V 8am-14pm', '044529998 (call center)', '8004272 (call center)', '+34609761641', 'www.marcosjusdado.com', ''])
      expect(extractMobile(raw), raw).toBeNull()
  })
})

describe('centro', () => {
  it('quita la web pegada al nombre del centro', () => {
    expect(cleanClinic('International Knee and Joint Centre / www.knee.ae')).toBe('International Knee and Joint Centre')
    expect(cleanClinic('Clínica X https://x.com/citas')).toBe('Clínica X')
    expect(cleanClinic('www.solo-web.com')).toBe('')
    expect(cleanClinic('Mediclinic City Hospital')).toBe('Mediclinic City Hospital')
  })
})

describe('correo', () => {
  it('toma la primera dirección válida en minúsculas', () => {
    expect(extractEmail(' Cerecei@CCAD.ae ')).toBe('cerecei@ccad.ae')
    expect(extractEmail('a@b.com / c@d.com')).toBe('a@b.com')
    expect(extractEmail('sin correo')).toBeNull()
  })
})

describe('preparación de la importación', () => {
  const header = ['', 'Especialidad', 'Nombre', 'E-mail', 'Telefono de contacto/citaciones', 'Emirato', 'Centro de Trabajo']
  const row = (name: string, over: Partial<Record<string, string>> = {}) => {
    const r = { Especialidad: 'Pediatría 🧸', Nombre: name, 'E-mail': '', 'Telefono de contacto/citaciones': '', Emirato: 'Dubai', 'Centro de Trabajo': 'Clínica X', ...over }
    return header.map((h) => (h ? r[h as keyof typeof r] ?? '' : ''))
  }

  it('omite fuera de EAU, duplicados por nombre y deja un solo dueño por teléfono o correo', () => {
    const r = prepareImport([
      header,
      row('Ana Pérez', { 'Telefono de contacto/citaciones': '0501234567', 'E-mail': 'ana@x.com' }),
      row('ana  pérez'),
      row('Luis Gómez', { Emirato: 'Kuwait' }),
      row('Marta Ruiz', { 'Telefono de contacto/citaciones': '+971 50 123 4567', 'E-mail': 'ANA@x.com' }),
      row('Sin Centro', { 'Centro de Trabajo': '' }),
    ])
    expect(r.doctors.map((d) => d.full_name)).toEqual(['Ana Pérez', 'Marta Ruiz', 'Sin Centro'])
    expect(r.doctors[0]).toMatchObject({ phone_e164: '+971501234567', email: 'ana@x.com', specialty: 'Pediatría', emirate: 'Dubái' })
    expect(r.doctors[1]).toMatchObject({ phone_e164: null, email: null })
    expect(r.doctors[2].clinic).toBe('Centro no indicado')
    expect(r.skipped.map((s) => s.reason)).toEqual(['Nombre repetido en el CSV', 'Emirato fuera de EAU o vacío: "Kuwait"'])
  })

  it('exige las columnas esperadas', () => {
    expect(() => prepareImport([['Nombre', 'Otra']])).toThrow(/Especialidad/)
  })
})
