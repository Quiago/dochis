import { describe, expect, it } from 'vitest'
import {
  confirmationMonths, facets, filterDoctors, freshness, initials, shuffle, slugify, timeAgo, waLink,
  type PublicDoctor,
} from '@/lib/directory'

const NOW = new Date('2026-09-21T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

const doc = (over: Partial<PublicDoctor>): PublicDoctor => ({
  id: 'x', slug: 'x', full_name: 'Dr. X', specialty: 'Pediatría', clinic: 'Clínica', area: 'Jumeirah',
  emirate: 'Dubái', languages: ['Español'], insurances: ['Daman'], regulator: 'DHA',
  public_whatsapp: null, status: 'verified', last_confirmed_at: daysAgo(10), license_number: 'DHA-1', insurance_url: null, photo_version: null, ...over,
})

const DOCS = [
  doc({ id: '1', full_name: 'Dra. Lucía Márquez', specialty: 'Pediatría', clinic: 'Palmera Kids', insurances: ['Daman', 'AXA'], languages: ['Español', 'Inglés'] }),
  doc({ id: '2', full_name: 'Dr. Omar Haddad', specialty: 'Cardiología', emirate: 'Sharjah', insurances: ['Bupa'], languages: ['Árabe', 'Español'] }),
  doc({ id: '3', full_name: 'Dra. Camila Restrepo', specialty: 'Ginecología', emirate: 'Abu Dabi', insurances: ['Thiqa'], languages: ['Español', 'Francés'] }),
]

describe('filterDoctors', () => {
  it('busca sin distinguir acentos ni mayúsculas en nombre, especialidad, clínica y zona', () => {
    expect(filterDoctors(DOCS, { q: 'LUCIA' }).map((d) => d.id)).toEqual(['1'])
    expect(filterDoctors(DOCS, { q: 'cardiologia' }).map((d) => d.id)).toEqual(['2'])
    expect(filterDoctors(DOCS, { q: 'palmera' }).map((d) => d.id)).toEqual(['1'])
  })

  it('combina filtros de especialidad, emirato, seguro e idioma', () => {
    expect(filterDoctors(DOCS, { emirato: 'Sharjah', idioma: 'Árabe' }).map((d) => d.id)).toEqual(['2'])
    expect(filterDoctors(DOCS, { seguro: 'AXA', esp: 'Pediatría' }).map((d) => d.id)).toEqual(['1'])
    expect(filterDoctors(DOCS, { idioma: 'Francés', emirato: 'Dubái' })).toEqual([])
    expect(filterDoctors(DOCS, {})).toHaveLength(3)
  })
})

describe('shuffle', () => {
  it('devuelve una permutación completa sin mutar la entrada', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const out = shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
    expect([...out].sort()).toEqual(input)
  })

  it('usa la fuente aleatoria (Fisher-Yates determinista con rand fijo)', () => {
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1])
    expect(shuffle([1, 2, 3], () => 0.999)).toEqual([1, 2, 3])
  })
})

describe('freshness', () => {
  it('confirmado hasta 35 días (un mes y margen), pendiente después, sin confirmar si unclaimed', () => {
    expect(freshness(doc({ last_confirmed_at: daysAgo(0) }), NOW)).toMatchObject({ kind: 'confirmed', label: 'Confirmado' })
    expect(freshness(doc({ last_confirmed_at: daysAgo(35) }), NOW).kind).toBe('confirmed')
    expect(freshness(doc({ last_confirmed_at: daysAgo(36) }), NOW)).toMatchObject({ kind: 'pending', label: 'Pendiente' })
    expect(freshness(doc({ status: 'stale', last_confirmed_at: daysAgo(10) }), NOW).kind).toBe('pending')
    expect(freshness(doc({ status: 'unclaimed', last_confirmed_at: null }), NOW)).toMatchObject({ kind: 'unclaimed', label: 'Sin confirmar' })
  })

  it('describe la frescura con los textos del prototipo', () => {
    expect(freshness(doc({ last_confirmed_at: daysAgo(12) }), NOW).text).toBe('Confirmado hace 12 días')
    expect(freshness(doc({ last_confirmed_at: daysAgo(120) }), NOW).text).toBe('Pendiente: no confirma sus datos desde 4 meses')
    expect(timeAgo(0)).toBe('hoy')
    expect(timeAgo(1)).toBe('hace 1 día')
    expect(timeAgo(75)).toBe('hace 3 meses')
  })
})

describe('waLink', () => {
  it('solo existe si hay public_whatsapp y lleva el mensaje prellenado', () => {
    expect(waLink(doc({ public_whatsapp: null }))).toBeNull()
    const link = waLink(doc({ public_whatsapp: '+971 50 123 4567' }))!
    expect(link.startsWith('https://wa.me/971501234567?text=')).toBe(true)
    expect(decodeURIComponent(link.split('text=')[1])).toMatch(/^Hola, vi su perfil en el directorio de médicos en español/)
  })
})

describe('helpers de perfil', () => {
  it('slugify es estable, sin acentos ni símbolos', () => {
    expect(slugify('Dra. Lucía Márquez Ortega')).toBe('dra-lucia-marquez-ortega')
    expect(slugify('  Dr. Javier Soler  Pons ')).toBe('dr-javier-soler-pons')
  })

  it('initials ignora el tratamiento', () => {
    expect(initials('Dra. Lucía Márquez Ortega')).toBe('LM')
    expect(initials('Dr. Omar Haddad')).toBe('OH')
  })

  it('facets devuelve valores únicos ordenados en español', () => {
    expect(facets(DOCS).idioma).toEqual(['Árabe', 'Español', 'Francés', 'Inglés'])
    expect(facets(DOCS).emirato).toEqual(['Abu Dabi', 'Dubái', 'Sharjah'])
  })

  it('confirmationMonths marca una celda por mes en los últimos 12', () => {
    const months = confirmationMonths([daysAgo(1), daysAgo(95), '2020-01-01T00:00:00Z'], NOW)
    expect(months).toHaveLength(12)
    expect(months.at(-1)).toEqual({ month: '2026-09', confirmed: true })
    expect(months.find((m) => m.month === '2026-06')?.confirmed).toBe(true)
    expect(months.filter((m) => m.confirmed)).toHaveLength(2)
    expect(months[0].month).toBe('2025-10')
  })
})

import { filterHref, parseFilters } from '@/lib/directory'

describe('filtros en la URL', () => {
  it('parseFilters toma solo claves conocidas, primer valor y sin vacíos', () => {
    expect(parseFilters({ q: ' ana ', esp: ['Pediatría', 'x'], emirato: '', foo: 'bar' })).toEqual({ q: 'ana', esp: 'Pediatría' })
  })

  it('filterHref cambia o quita un filtro conservando los demás', () => {
    const f = { q: 'ana', esp: 'Pediatría' }
    expect(filterHref(f, 'emirato', 'Dubái')).toBe('/?q=ana&esp=Pediatr%C3%ADa&emirato=Dub%C3%A1i')
    expect(filterHref(f, 'esp')).toBe('/?q=ana')
    expect(filterHref({ esp: 'x' }, 'esp')).toBe('/')
  })
})

import { directoryStats, facetCounts } from '@/lib/directory'

describe('columna lateral y cifras', () => {
  it('cuenta médicos por especialidad y emirato en orden alfabético (sin ranking)', () => {
    const docs = [...DOCS, doc({ id: '4', specialty: 'Cardiología', emirate: 'Dubái' })]
    const c = facetCounts(docs)
    expect(c.esp).toEqual([{ value: 'Cardiología', count: 2 }, { value: 'Ginecología', count: 1 }, { value: 'Pediatría', count: 1 }])
    expect(c.emirato.map((e) => e.value)).toEqual(['Abu Dabi', 'Dubái', 'Sharjah'])
  })

  it('cifras del directorio: total, especialidades y confirmados este mes', () => {
    const docs = [
      doc({ id: '1', last_confirmed_at: daysAgo(10) }),
      doc({ id: '2', specialty: 'Cardiología', last_confirmed_at: daysAgo(25) }),
      doc({ id: '3', status: 'unclaimed', last_confirmed_at: null }),
    ]
    expect(directoryStats(docs, NOW)).toEqual({ doctors: 3, specialties: 2, confirmedThisRound: 1 })
  })
})

import { clinicInsuranceFor, withClinicInsurance, type ClinicInsurance } from '@/lib/clinic-insurance'

describe('filtro por estado', () => {
  const docs = [
    doc({ id: 'c', last_confirmed_at: daysAgo(5) }),
    doc({ id: 'p', last_confirmed_at: daysAgo(50) }),
    doc({ id: 'u', status: 'unclaimed', last_confirmed_at: null }),
  ]
  it('filtra por la etiqueta que se ve (Confirmado, Pendiente, Sin confirmar)', () => {
    expect(filterDoctors(docs, { estado: 'Confirmado' }, NOW).map((d) => d.id)).toEqual(['c'])
    expect(filterDoctors(docs, { estado: 'Pendiente' }, NOW).map((d) => d.id)).toEqual(['p'])
    expect(filterDoctors(docs, { estado: 'Sin confirmar' }, NOW).map((d) => d.id)).toEqual(['u'])
  })
  it('las opciones del filtro salen en ese orden fijo y solo las que existen', () => {
    expect(facets(docs, NOW).estado).toEqual(['Confirmado', 'Pendiente', 'Sin confirmar'])
    expect(facets([docs[2]], NOW).estado).toEqual(['Sin confirmar'])
  })
})

describe('seguros según la web de la clínica', () => {
  const LIST: ClinicInsurance[] = [
    { clinic: 'Mediclinic', match: ['mediclinic'], insurers: ['Daman', 'AXA / GIG Gulf', 'Bupa'], networks_note: '', source_url: 'https://www.mediclinic.ae/x', checked: '2026-09-22', confidence: 'high' },
    { clinic: 'Clínica sin lista', match: ['sin lista'], insurers: [], networks_note: '', source_url: '', checked: '2026-09-22', confidence: 'low' },
  ]
  it('encuentra la clínica por palabras clave, sin tildes ni mayúsculas', () => {
    expect(clinicInsuranceFor('MEDICLINIC Parkview Hospital', LIST)?.clinic).toBe('Mediclinic')
    expect(clinicInsuranceFor('Otra clínica', LIST)).toBeNull()
    expect(clinicInsuranceFor('Clínica Sin Lista', LIST)).toBeNull()  // no insurers → nothing to show
  })
  it('compara por palabra completa y nunca muestra investigación de confianza baja', () => {
    const L: ClinicInsurance[] = [
      { ...LIST[0], clinic: 'NMC', match: ['nmc'] },
      { ...LIST[0], clinic: 'Dudosa', match: ['dudosa'], confidence: 'low' },
    ]
    expect(clinicInsuranceFor('NMC Royal Khalifa', L)?.clinic).toBe('NMC')
    expect(clinicInsuranceFor('Hnmcx Clinic', L)).toBeNull()
    expect(clinicInsuranceFor('Clínica Dudosa', L)).toBeNull()
  })
  it('ordena las etiquetas con las aseguradoras más comunes primero', async () => {
    const { byCommonFirst } = await import('@/lib/clinic-insurance')
    expect(byCommonFirst(['Aafiya', 'ADNIC', 'Bupa', 'Daman', 'Zeta'])).toEqual(['Daman', 'Bupa', 'ADNIC', 'Aafiya', 'Zeta'])
  })
  it('con dos centros gana el primero mencionado; las de reembolso se muestran aunque no tengan lista', () => {
    const L: ClinicInsurance[] = [
      { ...LIST[0], clinic: 'Dubai London', match: ['dubai london'] },
      { ...LIST[0], clinic: 'Harley', match: ['harley street'] },
      { ...LIST[0], clinic: 'Roze', match: ['roze'], insurers: [], reimbursement_only: true },
    ]
    expect(clinicInsuranceFor('Harley Street Medical Center // Dubai London Hospital', L)?.clinic).toBe('Harley')
    expect(withClinicInsurance(doc({ clinic: 'Dr Roze Biohealth Clinic' }), L)).toMatchObject({ clinic_insurers: [], clinic_reimbursement: true })
  })
  it('añade las aseguradoras de la clínica sin mezclarlas con las declaradas, y el filtro usa ambas', () => {
    const d = withClinicInsurance(doc({ id: 'm', clinic: 'Mediclinic City Hospital', insurances: ['Cigna'] }), LIST)
    expect(d.insurances).toEqual(['Cigna'])
    expect(d.clinic_insurers).toEqual(['Daman', 'AXA / GIG Gulf', 'Bupa'])  // common insurers first
    expect(filterDoctors([d], { seguro: 'Bupa' }).map((x) => x.id)).toEqual(['m'])
    expect(facets([d]).seguro).toEqual(['AXA / GIG Gulf', 'Bupa', 'Cigna', 'Daman'])
  })
})
