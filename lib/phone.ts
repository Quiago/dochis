import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

// E.164 or null. UAE is the default country for local formats like "050 123 4567".
export function toE164(input: string, country: CountryCode = 'AE'): string | null {
  const phone = parsePhoneNumberFromString(input.trim().replace(/^00/, '+'), country)
  return phone?.isValid() ? phone.number : null
}

export const isAllowedPhone = (e164: string, prefixes = process.env.OTP_ALLOWED_PREFIXES ?? '+971') =>
  prefixes.split(',').map((p) => p.trim()).filter(Boolean).some((p) => e164.startsWith(p))
