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
  public_whatsapp: string | null
  insurance_url: string | null
}

const MAX_TEXT = 120
const MAX_ITEMS = 20

const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const list = (...values: string[]) =>
  [...new Set(values.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean))]

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

  if (!fd.get('consent')) errors.consent = 'Para aparecer en el directorio tienes que aceptar que se publiquen tus datos profesionales.'

  if (Object.keys(errors).length) return { errors }
  return { data: { full_name, specialty, clinic, area, emirate, languages, insurances, regulator, license_number, public_whatsapp, insurance_url } }
}
