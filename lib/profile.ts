// Doctor profile form: parsing and validation shared by sign-up, claim and edit.
import { toE164 } from './phone'

export const EMIRATES = ['Abu Dabi', 'Dubái', 'Sharjah', 'Ajmán', 'Umm al-Qaiwain', 'Ras al-Jaima', 'Fujaira'] as const
export const REGULATORS = ['DHA', 'DOH', 'MOHAP'] as const
export const REGULATOR_LABELS = { DHA: 'DHA (Dubái)', DOH: 'DOH (Abu Dabi)', MOHAP: 'MOHAP (resto de emiratos)' } as const
export const COMMON_LANGUAGES = ['Español', 'Inglés', 'Árabe', 'Francés', 'Portugués', 'Italiano', 'Catalán', 'Alemán', 'Ruso']

export type ProfileData = {
  full_name: string
  specialty: string
  clinic: string
  area: string | null
  emirate: string
  languages: string[]
  insurances: string[]
  regulator: (typeof REGULATORS)[number]
  license_number: string
  show_license: boolean
  public_whatsapp: string | null
  insurance_url: string | null
  public_email: string | null
  links: string[]
  hours_weekday_open: string | null
  hours_weekday_close: string | null
  hours_weekend_open: string | null
  hours_weekend_close: string | null
}

// Redes admitidas. La comprobación es por host exacto o subdominio ("instagram.com" o "www.instagram.com"),
// nunca "contiene": "instagram.com.evil.io" no es Instagram.
export const SOCIAL_HOSTS = ['instagram.com', 'linkedin.com', 'tiktok.com', 'x.com', 'facebook.com', 'youtube.com'] as const
// Los acortadores esconden el destino y anularían la lista blanca.
const SHORTENERS = ['bit.ly', 'linktr.ee', 'tinyurl.com', 't.co', 'lnk.bio', 'beacons.ai']
const MAX_LINKS = 5

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')
const isOn = (host: string, list: readonly string[]) => list.some((d) => host === d || host.endsWith(`.${d}`))

export function parseLinks(raw: string): { links?: string[]; error?: string } {
  const lines = [...new Set(raw.split('\n').map((l) => l.trim()).filter(Boolean))]
  if (lines.length > MAX_LINKS) return { error: `Como mucho cinco enlaces.` }
  let free = 0
  for (const l of lines) {
    if (l.length > 300) return { error: 'Cada enlace puede tener como mucho 300 caracteres.' }
    let host: string
    try {
      if (new URL(l).protocol !== 'https:') return { error: 'Los enlaces tienen que empezar por https://' }
      host = hostOf(l)
    } catch { return { error: `Ese enlace no es válido: ${l}` } }
    if (isOn(host, SHORTENERS)) return { error: 'No admitimos acortadores de enlaces: pega la dirección completa.' }
    if (isOn(host, SOCIAL_HOSTS)) continue
    if (++free > 1) return { error: 'Solo puedes añadir una página web, además de tus redes.' }
  }
  return { links: lines }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
export function parseHours(open: string, close: string): { open: string | null; close: string | null; error?: string } {
  if (!open && !close) return { open: null, close: null }
  if (!open || !close) return { open: null, close: null, error: 'Escribe las dos horas, la de apertura y la de cierre.' }
  if (!HHMM.test(open) || !HHMM.test(close)) return { open: null, close: null, error: 'Usa el formato 09:00.' }
  if (open >= close) return { open: null, close: null, error: 'La hora de apertura tiene que ser antes que la de cierre. Si cierras pasada la medianoche, pon la hora de cierre real del día.' }
  return { open, close }
}

const MAX_TEXT = 120
const MAX_ITEMS = 20

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const list = (...values: string[]) =>
  [...new Set(values.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean))]

// What the visitor typed, kept as plain serializable values (React 19 resets an uncontrolled form after the
// action runs, so on a validation error we hand these back as the new defaultValue/defaultChecked).
export type FormValues = {
  full_name: string
  specialty: string
  clinic: string
  area: string
  emirate: string
  languages: string[]
  other_languages: string
  insurances: string
  regulator: string
  license_number: string
  show_license: boolean
  show_whatsapp: boolean
  public_whatsapp: string
  insurance_url: string
  public_email: string
  links: string
  hours_weekday_open: string
  hours_weekday_close: string
  hours_weekend_open: string
  hours_weekend_close: string
  consent: boolean
}

const raw = (fd: FormData, k: string) => String(fd.get(k) ?? '')

export function formValues(fd: FormData): FormValues {
  return {
    full_name: raw(fd, 'full_name'),
    specialty: raw(fd, 'specialty'),
    clinic: raw(fd, 'clinic'),
    area: raw(fd, 'area'),
    emirate: raw(fd, 'emirate'),
    languages: fd.getAll('languages').map(String),
    other_languages: raw(fd, 'other_languages'),
    insurances: raw(fd, 'insurances'),
    regulator: raw(fd, 'regulator'),
    license_number: raw(fd, 'license_number'),
    show_license: !!fd.get('show_license'),
    show_whatsapp: !!fd.get('show_whatsapp'),
    public_whatsapp: raw(fd, 'public_whatsapp'),
    insurance_url: raw(fd, 'insurance_url'),
    public_email: raw(fd, 'public_email'),
    links: raw(fd, 'links'),
    hours_weekday_open: raw(fd, 'hours_weekday_open'),
    hours_weekday_close: raw(fd, 'hours_weekday_close'),
    hours_weekend_open: raw(fd, 'hours_weekend_open'),
    hours_weekend_close: raw(fd, 'hours_weekend_close'),
    consent: !!fd.get('consent'),
  }
}

export function parseProfileForm(fd: FormData): { data?: ProfileData; errors?: Record<string, string> } {
  const errors: Record<string, string> = {}
  const required = (k: string, label: string) => {
    const v = text(fd, k)
    if (!v) errors[k] = `Escribe ${label}.`
    else if (v.length > MAX_TEXT) errors[k] = `Máximo ${MAX_TEXT} caracteres.`
    return v
  }

  const full_name = required('full_name', 'tu nombre completo')
  const specialty = required('specialty', 'tu especialidad')
  const clinic = required('clinic', 'tu clínica o centro')
  const license_number = required('license_number', 'tu número de licencia')
  const area = text(fd, 'area').slice(0, MAX_TEXT) || null

  const emirate = text(fd, 'emirate')
  if (!(EMIRATES as readonly string[]).includes(emirate)) errors.emirate = 'Elige un emirato.'
  const regulator = text(fd, 'regulator') as ProfileData['regulator']
  if (!REGULATORS.includes(regulator)) errors.regulator = 'Elige la autoridad de tu licencia.'

  const languages = list(...fd.getAll('languages').map(String), text(fd, 'other_languages'))
  if (!languages.length) errors.languages = 'Marca al menos un idioma.'
  const insurances = list(text(fd, 'insurances'))
  for (const [k, items] of [['languages', languages], ['insurances', insurances]] as const) {
    if (items.length > MAX_ITEMS || items.some((i) => i.length > 40)) errors[k] = `Máximo ${MAX_ITEMS} elementos de 40 caracteres.`
  }

  const show_license = !!fd.get('show_license')

  let public_whatsapp: string | null = null
  if (fd.get('show_whatsapp')) {
    public_whatsapp = toE164(text(fd, 'public_whatsapp'))
    if (!public_whatsapp) errors.public_whatsapp = 'Escribe el número completo con prefijo.'
  }

  // Link to the clinic's official list of accepted insurers/plans/networks: the only reliable source.
  let insurance_url: string | null = text(fd, 'insurance_url') || null
  if (insurance_url) {
    let ok = false
    try { ok = new URL(insurance_url).protocol === 'https:' && insurance_url.length <= 300 } catch {}
    if (!ok) { errors.insurance_url = 'Pega un enlace completo que empiece por https:// (máximo 300 caracteres).'; insurance_url = null }
  }

  let public_email: string | null = text(fd, 'public_email').replace(/^mailto:/i, '').trim().toLowerCase() || null
  if (public_email && (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(public_email) || public_email.length > MAX_TEXT)) {
    errors.public_email = 'Escribe un correo válido, o déjalo vacío.'
    public_email = null
  }

  const parsedLinks = parseLinks(text(fd, 'links'))
  if (parsedLinks.error) errors.links = parsedLinks.error
  const links = parsedLinks.links ?? []

  const weekday = parseHours(text(fd, 'hours_weekday_open'), text(fd, 'hours_weekday_close'))
  if (weekday.error) errors.hours_weekday = weekday.error
  const weekend = parseHours(text(fd, 'hours_weekend_open'), text(fd, 'hours_weekend_close'))
  if (weekend.error) errors.hours_weekend = weekend.error

  if (!fd.get('consent')) errors.consent = 'Para aparecer en el directorio tienes que aceptar que se publiquen tus datos profesionales.'

  if (Object.keys(errors).length) return { errors }
  return {
    data: {
      full_name, specialty, clinic, area, emirate, languages, insurances, regulator, license_number, show_license, public_whatsapp, insurance_url,
      public_email, links,
      hours_weekday_open: weekday.open, hours_weekday_close: weekday.close,
      hours_weekend_open: weekend.open, hours_weekend_close: weekend.close,
    },
  }
}
