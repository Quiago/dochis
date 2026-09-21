// Pure directory logic: no I/O, shared by server pages and tests.

export type Regulator = 'DHA' | 'DOH' | 'MOHAP'
export type PublicStatus = 'unclaimed' | 'verified' | 'stale'

// Row shape of the public_doctors view (unclaimed rows come with nulls).
export type PublicDoctor = {
  id: string
  slug: string
  full_name: string
  specialty: string
  clinic: string
  area: string | null
  emirate: string
  languages: string[]
  insurances: string[]
  regulator: Regulator | null
  public_whatsapp: string | null
  status: PublicStatus
  last_confirmed_at: string | null
}

export type Filters = { q?: string; esp?: string; emirato?: string; seguro?: string; idioma?: string }

export const STALE_DAYS = 90
const DAY = 86_400_000

export const normalize = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function filterDoctors(docs: PublicDoctor[], f: Filters): PublicDoctor[] {
  const q = normalize(f.q?.trim() ?? '')
  return docs.filter(
    (d) =>
      (!q || normalize(`${d.full_name} ${d.specialty} ${d.clinic} ${d.area ?? ''}`).includes(q)) &&
      (!f.esp || d.specialty === f.esp) &&
      (!f.emirato || d.emirate === f.emirato) &&
      (!f.seguro || d.insurances.includes(f.seguro)) &&
      (!f.idioma || d.languages.includes(f.idioma)),
  )
}

// Fisher-Yates. Random order per visit is a product principle (fair visibility).
export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = [...items]
  for (let k = out.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1))
    ;[out[k], out[j]] = [out[j], out[k]]
  }
  return out
}

export function timeAgo(days: number): string {
  if (days < 1) return 'hoy'
  if (days === 1) return 'hace 1 día'
  if (days < 60) return `hace ${days} días`
  return `hace ${Math.round(days / 30)} meses`
}

export type Freshness = {
  kind: 'confirmed' | 'pending' | 'unclaimed'
  label: 'Confirmado' | 'Pendiente' | 'Sin confirmar'
  text: string
}

// Effective status: a verified profile past 90 days reads as pending even before the cron flips it.
export function freshness(d: PublicDoctor, now = new Date()): Freshness {
  if (d.status === 'unclaimed' || !d.last_confirmed_at) {
    return { kind: 'unclaimed', label: 'Sin confirmar', text: 'Perfil sin confirmar. Datos tomados de la lista anterior del grupo.' }
  }
  const days = Math.floor((now.getTime() - new Date(d.last_confirmed_at).getTime()) / DAY)
  if (d.status === 'stale' || days > STALE_DAYS) {
    return { kind: 'pending', label: 'Pendiente', text: `Pendiente: no confirma sus datos desde ${timeAgo(days).replace('hace ', '')}` }
  }
  return { kind: 'confirmed', label: 'Confirmado', text: `Confirmado ${timeAgo(days)}` }
}

export const CONTACT_MESSAGE = 'Hola, vi su perfil en el directorio de médicos en español y quisiera pedir una cita.'

export function waLink(d: Pick<PublicDoctor, 'public_whatsapp'>): string | null {
  if (!d.public_whatsapp) return null
  return `https://wa.me/${d.public_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(CONTACT_MESSAGE)}`
}

export const slugify = (name: string) =>
  normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w && !/^dra?\.?$/i.test(w))
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

const uniqSorted = (vals: string[]) => [...new Set(vals)].sort((a, b) => a.localeCompare(b, 'es'))

export function facets(docs: PublicDoctor[]) {
  return {
    esp: uniqSorted(docs.map((d) => d.specialty)),
    emirato: uniqSorted(docs.map((d) => d.emirate)),
    seguro: uniqSorted(docs.flatMap((d) => d.insurances)),
    idioma: uniqSorted(docs.flatMap((d) => d.languages)),
  }
}

// Counts per specialty / emirate for the sidebar, alphabetical on purpose (no ranking, principle 4).
export function facetCounts(docs: PublicDoctor[]) {
  const count = (vals: string[]) => {
    const m = new Map<string, number>()
    for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([value, count]) => ({ value, count }))
  }
  return { esp: count(docs.map((d) => d.specialty)), emirato: count(docs.map((d) => d.emirate)) }
}

// First day of the current quarter (UTC): each confirmation round starts there.
export const roundStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1))

export function directoryStats(docs: PublicDoctor[], now = new Date()) {
  const start = roundStart(now).getTime()
  return {
    doctors: docs.length,
    specialties: new Set(docs.map((d) => d.specialty)).size,
    confirmedThisRound: docs.filter((d) => d.last_confirmed_at && new Date(d.last_confirmed_at).getTime() >= start).length,
  }
}

// One cell per month (oldest first) for the contribution-style graph.
export function confirmationMonths(dates: string[], now = new Date(), months = 12) {
  const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const confirmed = new Set(dates.map((d) => key(new Date(d))))
  return Array.from({ length: months }, (_, i) => {
    const m = key(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1)))
    return { month: m, confirmed: confirmed.has(m) }
  })
}

export const FILTER_KEYS = ['q', 'esp', 'emirato', 'seguro', 'idioma'] as const

// Reads ?q=&esp=&emirato=&seguro=&idioma= ignoring unknown or repeated params.
export function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const out: Filters = {}
  for (const k of FILTER_KEYS) {
    const v = params[k]
    const s = (Array.isArray(v) ? v[0] : v)?.trim()
    if (s) out[k] = s
  }
  return out
}

// Link for a filter menu item; value undefined clears that filter.
export function filterHref(f: Filters, key: keyof Filters, value?: string): string {
  const qs = new URLSearchParams()
  for (const k of FILTER_KEYS) {
    const v = k === key ? value : f[k]
    if (v) qs.set(k, v)
  }
  const s = qs.toString()
  return s ? `/?${s}` : '/'
}
