import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { normalize } from './directory'

export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export const hashCode = (code: string, pepper: string) => createHmac('sha256', pepper).update(code).digest('hex')

export function codesMatch(code: string, hash: string, pepper: string): boolean {
  const a = Buffer.from(hashCode(code, pepper), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

// "CODIGO 123456" as prefilled by the wa.me link; tolerates accents, case, extra spaces and a colon.
export function parseCodeMessage(text: string): string | null {
  return normalize(text).trim().match(/^codigo\s*:?\s*(\d{6})$/)?.[1] ?? null
}
