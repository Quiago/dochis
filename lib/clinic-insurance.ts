// Insurers each clinic says it accepts on its own website: acceptance depends on the clinic + plan + network, not on
// the doctor. Researched from official sources only (see clinic-insurance-data.ts); reviewable in pull requests.
import { normalize, type PublicDoctor } from './directory.ts'
import { CLINIC_INSURANCE } from './clinic-insurance-data.ts'

export type ClinicInsurance = {
  clinic: string; match: string[]; insurers: string[]; networks_note: string
  source_url: string; checked: string; confidence: 'high' | 'medium' | 'low'
}

export function clinicInsuranceFor(clinic: string, list: ClinicInsurance[] = CLINIC_INSURANCE): ClinicInsurance | null {
  const key = normalize(clinic)
  return list.find((c) => c.insurers.length && c.match.some((m) => key.includes(normalize(m)))) ?? null
}

export function withClinicInsurance(d: PublicDoctor, list: ClinicInsurance[] = CLINIC_INSURANCE): PublicDoctor {
  const c = clinicInsuranceFor(d.clinic, list)
  return { ...d, clinic_insurers: c?.insurers ?? [], clinic_insurance_source: c?.source_url ?? null }
}
