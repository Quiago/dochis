// Phase 5: import the group's spreadsheet as unclaimed profiles (public: only name, specialty and centre).
// Everything here is deterministic and reviewable: rules below + a report of every mapping and skipped row.
import type postgres from 'postgres'
import { normalize } from './directory.ts'
import { uniqueSlug } from './onboarding.ts'
import { toE164 } from './phone.ts'

// Minimal RFC 4180 parser: quotes, escaped quotes, commas and newlines inside fields, CRLF, BOM.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const stripEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').replace(/\s+/g, ' ').trim()

// Order matters: the first matching rule wins (e.g. "Odontología/Ortodoncia" → Ortodoncia, "Pediatría intensiva" → Pediatría).
const SPECIALTY_RULES: [RegExp, string][] = [
  [/pediatr/, 'Pediatría'],
  [/ortodon|orthodont/, 'Ortodoncia'],
  [/plastic/, 'Cirugía plástica'],
  [/cirugia oral|cirujano oral|maxilofacial/, 'Cirugía oral y maxilofacial'],
  [/cirugia toracica/, 'Cirugía torácica'],
  [/cirugia vascular/, 'Cirugía vascular'],
  [/cirugia general/, 'Cirugía general y digestiva'],
  [/neurocirug/, 'Neurocirugía'],
  [/radiolog/, 'Radiología'],
  [/\burolog/, 'Urología'],  // \b: "neurología" contains "urolog"
  [/alerg/, 'Alergología'],
  [/anestes/, 'Anestesiología'],
  [/cardio/, 'Cardiología'],
  [/dermato/, 'Dermatología'],
  [/donacion/, 'Donación de órganos'],
  [/enfermeria/, 'Enfermería'],
  [/fertilidad/, 'Fertilidad'],
  [/fisioterap/, 'Fisioterapia'],
  [/gastro/, 'Gastroenterología'],
  [/genetica/, 'Genética'],
  [/ginecolog|obstetric/, 'Ginecología y obstetricia'],
  [/hemato/, 'Hematología'],
  [/infecto/, 'Infectología'],
  [/intensiv/, 'Medicina intensiva'],
  [/logoped/, 'Logopedia'],
  [/longevidad/, 'Medicina de la longevidad'],
  [/psiquiatr/, 'Psiquiatría'],
  [/psicolog/, 'Psicología'],
  [/neurolog/, 'Neurología'],
  [/traumatolog|rehabilitacion/, 'Traumatología'],
  [/odontolog/, 'Odontología'],
  [/familia|medicina general/, 'Medicina familiar'],
  [/estetica/, 'Medicina estética'],
  [/deportiv|sport/, 'Medicina deportiva'],
  [/medicina interna/, 'Medicina interna'],
  [/preventiva/, 'Medicina preventiva'],
  [/trabajo/, 'Medicina del trabajo'],
  [/nefrolog/, 'Nefrología'],
  [/neonatolog/, 'Neonatología'],
  [/neumolog/, 'Neumología'],
  [/nutricion/, 'Nutrición'],
  [/oftalmolog/, 'Oftalmología'],
  [/oncolog/, 'Oncología'],
  [/optometr/, 'Optometría'],
  [/otorrino/, 'Otorrinolaringología'],
  [/pedagog/, 'Pedagogía'],
  [/podolog/, 'Podología'],
  [/reumatolog/, 'Reumatología'],
]

export function normalizeSpecialty(raw: string): { value: string; mapped: boolean } {
  const clean = stripEmoji(raw)
  const key = normalize(clean)
  const rule = SPECIALTY_RULES.find(([re]) => re.test(key))
  return rule ? { value: rule[1], mapped: true } : { value: clean, mapped: false }
}

// Takes the first emirate mentioned ("Abu Dhabi/Dubai" → Abu Dabi). Al Ain belongs to Abu Dhabi.
const EMIRATE_RULES: [RegExp, string][] = [
  [/^(dubai|duabi)/, 'Dubái'],
  [/^(abu dh?ab|al ain)/, 'Abu Dabi'],
  [/^(ajman|ahman)/, 'Ajmán'],
  [/^sharja/, 'Sharjah'],
  [/^ras al/, 'Ras al-Jaima'],
  [/^fujair/, 'Fujaira'],
  [/^umm al/, 'Umm al-Qaiwain'],
]

export function normalizeEmirate(raw: string): string | null {
  const key = normalize(raw).trim()
  return EMIRATE_RULES.find(([re]) => re.test(key))?.[1] ?? null
}

// Only UAE mobiles (+9715…) become login phones: landlines and call centres are shared by a whole clinic.
export function extractMobile(raw: string): string | null {
  for (const token of raw.match(/\+?\d[\d\s-]{6,}\d/g) ?? []) {
    const digits = token.replace(/[^\d+]/g, '')
    const e164 = toE164(/^971/.test(digits) ? `+${digits}` : digits)
    if (e164 && /^\+9715\d{8}$/.test(e164)) return e164
  }
  return null
}

// Some centres carry their website ("Clinic / www.x.ae"): keep only the name.
export const cleanClinic = (raw: string) =>
  raw.replace(/\s*[/|-]?\s*(https?:\/\/|www\.)\S+/gi, '').replace(/\s+/g, ' ').trim()

export const extractEmail = (raw: string) => raw.match(/[^\s@/,;<>]+@[^\s@/,;<>]+\.[a-z]{2,}/i)?.[0].toLowerCase() ?? null

export type ImportDoctor = {
  full_name: string; specialty: string; clinic: string; emirate: string
  phone_e164: string | null; email: string | null; line: number
}
export type Skipped = { line: number; name: string; reason: string }

const COLUMNS = { specialty: 'Especialidad', name: 'Nombre', email: 'E-mail', phone: 'Telefono de contacto/citaciones', emirate: 'Emirato', clinic: 'Centro de Trabajo' }

export function prepareImport(rows: string[][]) {
  const [header, ...data] = rows
  const idx = Object.fromEntries(Object.entries(COLUMNS).map(([k, col]) => [k, header.findIndex((h) => h.trim() === col)]))
  const missing = Object.entries(COLUMNS).filter(([k]) => idx[k] < 0).map(([, col]) => col)
  if (missing.length) throw new Error(`Faltan columnas en el CSV: ${missing.join(', ')}`)

  const doctors: ImportDoctor[] = []
  const skipped: Skipped[] = []
  const specialties = new Map<string, { value: string; mapped: boolean }>()
  const names = new Set<string>(), phones = new Set<string>(), emails = new Set<string>()

  data.forEach((r, i) => {
    const line = i + 2
    const get = (k: keyof typeof COLUMNS) => (r[idx[k]] ?? '').trim()
    const full_name = get('name').replace(/\s+/g, ' ')
    if (!full_name) return
    const key = normalize(full_name)
    if (names.has(key)) return skipped.push({ line, name: full_name, reason: 'Nombre repetido en el CSV' })
    const emirate = normalizeEmirate(get('emirate'))
    if (!emirate) return skipped.push({ line, name: full_name, reason: `Emirato fuera de EAU o vacío: "${get('emirate')}"` })
    names.add(key)

    const spec = normalizeSpecialty(get('specialty'))
    specialties.set(get('specialty'), spec)
    let phone = extractMobile(get('phone'))
    if (phone && phones.has(phone)) phone = null
    let email = extractEmail(get('email'))
    if (email && emails.has(email)) email = null
    if (phone) phones.add(phone)
    if (email) emails.add(email)
    doctors.push({ full_name, specialty: spec.value, clinic: cleanClinic(get('clinic')) || 'Centro no indicado', emirate, phone_e164: phone, email, line })
  })
  return { doctors, skipped, specialties }
}

// Inserts unclaimed profiles. Idempotent: a name already in the directory is skipped, and a phone or email
// already used by another doctor is dropped (it stays unique and private).
export async function importDoctors(sql: postgres.Sql, doctors: ImportDoctor[]) {
  const inserted: string[] = []
  const skipped: Skipped[] = []
  await sql.begin(async (tx) => {
    for (const d of doctors) {
      const [dup] = await tx`select 1 from doctors where lower(full_name) = lower(${d.full_name})`
      if (dup) { skipped.push({ line: d.line, name: d.full_name, reason: 'Ya existe en el directorio' }); continue }
      const [taken] = await tx`
        select (phone_e164 = ${d.phone_e164}) as phone, (lower(email) = ${d.email}) as email from doctors
        where phone_e164 = ${d.phone_e164} or lower(email) = ${d.email}`
      const slug = await uniqueSlug(tx, d.full_name)
      await tx`insert into doctors ${tx({
        slug, full_name: d.full_name, specialty: d.specialty, clinic: d.clinic, emirate: d.emirate, status: 'unclaimed',
        phone_e164: taken?.phone ? null : d.phone_e164, email: taken?.email ? null : d.email,
      })}`
      inserted.push(slug)
    }
  })
  return { inserted, skipped }
}
