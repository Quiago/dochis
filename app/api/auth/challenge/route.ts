import { NextResponse } from 'next/server'
import { challengeStatus, consumeChallenge, createChallenge } from '@/lib/auth'
import { writer } from '@/lib/db'
import { normalizeEmail, sendLoginCode } from '@/lib/email'
import { clearChallengeCookie, getChallengeCookie, setChallengeCookie } from '@/lib/login-cookie'
import { isAllowedPhone, toE164 } from '@/lib/phone'
import { clientIp } from '@/lib/request'
import { loginChannels, startSession } from '@/lib/session'
import { codeLink } from '@/lib/whatsapp'

const ERRORS = {
  invalid_phone: 'Escribe el número completo con prefijo, por ejemplo +971 50 123 4567.',
  invalid_email: 'Escribe un correo válido, por ejemplo nombre@gmail.com.',
  not_allowed: 'Por ahora solo aceptamos números de los Emiratos (+971).',
  unavailable: 'Este método de entrada no está disponible ahora mismo.',
  send_failed: 'No pudimos enviar el correo. Inténtalo de nuevo en unos minutos.',
  rate_limited_identity: 'Demasiados intentos con este número o correo. Espera una hora e inténtalo de nuevo.',
  rate_limited_ip: 'Demasiados intentos desde esta conexión. Espera una hora e inténtalo de nuevo.',
  daily_cap: 'Hoy hay demasiadas solicitudes. Inténtalo mañana.',
} as const

const fail = (key: keyof typeof ERRORS, status = 400) => NextResponse.json({ error: ERRORS[key] }, { status })

// Body: { phone } → WhatsApp reverse OTP (code shown here). { email } → code emailed, typed on /api/auth/verify.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const channels = loginChannels()
  const common = { ip: clientIp(req.headers), pepper: process.env.OTP_PEPPER!, dailyCap: Number(process.env.OTP_DAILY_CAP ?? 200) }

  if (typeof body.email === 'string') {
    if (!channels.includes('email')) return fail('unavailable')
    const email = normalizeEmail(body.email)
    if (!email) return fail('invalid_email')
    const result = await createChallenge(writer(), { email, ...common })
    if ('error' in result) return fail(result.error, 429)
    try {
      await sendLoginCode(email, result.code)
    } catch (e) {
      console.error('email', e)
      return fail('send_failed', 502)
    }
    await setChallengeCookie(result.id)
    return NextResponse.json({ channel: 'email', email })
  }

  if (!channels.includes('whatsapp')) return fail('unavailable')
  const phone = typeof body.phone === 'string' ? toE164(body.phone) : null
  if (!phone) return fail('invalid_phone')
  if (!isAllowedPhone(phone)) return fail('not_allowed')
  const result = await createChallenge(writer(), { phone, ...common })
  if ('error' in result) return fail(result.error, 429)
  await setChallengeCookie(result.id)
  return NextResponse.json({ channel: 'whatsapp', phone, code: result.code, link: codeLink(process.env.NEXT_PUBLIC_BOT_NUMBER!, result.code) })
}

// WhatsApp channel: polled every 2 s by the login page. On verification it sets the session cookie once.
export async function GET() {
  const id = await getChallengeCookie()
  if (!id) return NextResponse.json({ status: 'expired' })
  const status = await challengeStatus(writer(), id)
  if (status !== 'verified') return NextResponse.json({ status })
  const identity = await consumeChallenge(writer(), id)
  await clearChallengeCookie()
  if (!identity) return NextResponse.json({ status: 'expired' })
  await startSession(identity)
  return NextResponse.json({ status: 'verified' })
}
