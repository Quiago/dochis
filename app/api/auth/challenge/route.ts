import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { challengeStatus, consumeChallenge, createChallenge } from '@/lib/auth'
import { writer } from '@/lib/db'
import { isAllowedPhone, toE164 } from '@/lib/phone'
import { clientIp } from '@/lib/request'
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS } from '@/lib/session'
import { codeLink } from '@/lib/whatsapp'

// The challenge id lives only in this httpOnly cookie: knowing an id elsewhere never yields a session.
const CHALLENGE_COOKIE = 'login_challenge'
const secure = process.env.NODE_ENV === 'production'

const ERRORS = {
  invalid_phone: 'Escribe el número completo con prefijo, por ejemplo +971 50 123 4567.',
  not_allowed: 'Por ahora solo aceptamos números de los Emiratos (+971).',
  rate_limited_phone: 'Demasiados intentos con este número. Espera una hora e inténtalo de nuevo.',
  rate_limited_ip: 'Demasiados intentos desde esta conexión. Espera una hora e inténtalo de nuevo.',
  daily_cap: 'Hoy hay demasiadas solicitudes. Inténtalo mañana.',
} as const

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const phone = typeof body.phone === 'string' ? toE164(body.phone) : null
  if (!phone) return NextResponse.json({ error: ERRORS.invalid_phone }, { status: 400 })
  if (!isAllowedPhone(phone)) return NextResponse.json({ error: ERRORS.not_allowed }, { status: 400 })

  const result = await createChallenge(writer(), {
    phone,
    ip: clientIp(req.headers),
    pepper: process.env.OTP_PEPPER!,
    dailyCap: Number(process.env.OTP_DAILY_CAP ?? 200),
  })
  if ('error' in result) return NextResponse.json({ error: ERRORS[result.error] }, { status: 429 })

  ;(await cookies()).set(CHALLENGE_COOKIE, result.id, { httpOnly: true, secure, sameSite: 'lax', path: '/api/auth', maxAge: 600 })
  return NextResponse.json({ phone, code: result.code, link: codeLink(process.env.NEXT_PUBLIC_BOT_NUMBER!, result.code) })
}

// Polled every 2 s by the login page. On verification it sets the session cookie once.
export async function GET() {
  const jar = await cookies()
  const id = jar.get(CHALLENGE_COOKIE)?.value
  if (!id) return NextResponse.json({ status: 'expired' })
  const status = await challengeStatus(writer(), id)
  if (status !== 'verified') return NextResponse.json({ status })

  const phone = await consumeChallenge(writer(), id)
  jar.delete({ name: CHALLENGE_COOKIE, path: '/api/auth' })
  if (!phone) return NextResponse.json({ status: 'expired' })
  jar.set(SESSION_COOKIE, await createSessionToken(phone), { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86_400 })
  return NextResponse.json({ status: 'verified' })
}
