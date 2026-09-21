import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'sesion'
export const SESSION_DAYS = 30

function key() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres')
  return new TextEncoder().encode(secret)
}

// Subject is the login identity: an E.164 phone or an email address.
export async function createSessionToken(identity: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(identity).setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`).sign(key())
}

export type Session = { phone: string; email?: never } | { email: string; phone?: never }

export async function readSessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] })
    if (!payload.sub) return null
    return payload.sub.includes('@') ? { email: payload.sub } : { phone: payload.sub }
  } catch {
    return null
  }
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return token ? readSessionToken(token) : null
}

// Sets the session cookie (route handlers only).
export async function startSession(identity: string) {
  ;(await cookies()).set(SESSION_COOKIE, await createSessionToken(identity), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86_400,
  })
}

// Login channels available with the current configuration.
export function loginChannels() {
  const channels: ('whatsapp' | 'email')[] = []
  if (process.env.WHATSAPP_TOKEN && process.env.NEXT_PUBLIC_BOT_NUMBER) channels.push('whatsapp')
  if (process.env.SMTP_URL) channels.push('email')
  return channels
}
