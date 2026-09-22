// Insurers each clinic says it accepts on its own website: acceptance depends on the clinic + plan + network, not on
// the doctor. Researched from official sources only (see clinic-insurance-data.ts); reviewable in pull requests.
import { normalize, type PublicDoctor } from './directory.ts'
import { CLINIC_INSURANCE } from './clinic-insurance-data.ts'

export type ClinicInsurance = {
  clinic: string; match: string[]; insurers: string[]; networks_note: string
  source_url: string; checked: string; confidence: 'high' | 'medium' | 'low'
  // Pay-and-claim clinics: the patient pays and claims from the insurer (no direct billing).
  reimbursement_only?: boolean
}

const words = (s: string) => ` ${normalize(s).replace(/[^a-z0-9]+/g, ' ').trim()} `

// Whole-word match (short keys like "nmc" must not hit inside other words); with two centres ("A // B") the one
// mentioned first wins. Low-confidence research is never shown.
export function clinicInsuranceFor(clinic: string, list: ClinicInsurance[] = CLINIC_INSURANCE): ClinicInsurance | null {
  const text = words(clinic)
  let best: { c: ClinicInsurance; at: number } | null = null
  for (const c of list) {
    if (c.confidence === 'low' || (!c.insurers.length && !c.reimbursement_only)) continue
    for (const m of c.match) {
      const at = text.indexOf(words(m))
      if (at >= 0 && (!best || at < best.at)) best = { c, at }
    }
  }
  return best?.c ?? null
}

// Most common UAE insurers first so the visible labels are the useful ones (label order only, never doctor order).
const COMMON = ['Daman', 'Thiqa', 'AXA / GIG Gulf', 'Bupa', 'Cigna', 'Allianz', 'MetLife', 'Sukoon (Oman Insurance)', 'NAS', 'NextCare',
  'MedNet', 'Neuron', 'Aetna', 'Now Health', 'ADNIC', 'Orient', 'Dubai Insurance', 'Enaya', 'Saada', 'Almadallah']
const rank = (i: string) => { const r = COMMON.indexOf(i); return r < 0 ? COMMON.length : r }
export const byCommonFirst = (list: string[]) => [...list].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'es'))

export function withClinicInsurance(d: PublicDoctor, list: ClinicInsurance[] = CLINIC_INSURANCE): PublicDoctor {
  const c = clinicInsuranceFor(d.clinic, list)
  return { ...d, clinic_insurers: byCommonFirst(c?.insurers ?? []), clinic_insurance_source: c?.source_url ?? null, clinic_reimbursement: !!c?.reimbursement_only }
}
