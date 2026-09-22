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
  public_whatsapp: null, status: 'verified', last_confirmed_at: daysAgo(10), license_number: 'DHA-1', insurance_url: null, ...over,
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
