import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'sesion'
export const SESSION_DAYS = 30

function key() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres')
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(phone: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(phone).setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`).sign(key())
}

export async function readSessionToken(token: string): Promise<{ phone: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] })
    return payload.sub ? { phone: payload.sub } : null
  } catch {
    return null
  }
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return token ? readSessionToken(token) : null
}
