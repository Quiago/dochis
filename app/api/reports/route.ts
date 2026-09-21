import { createHash } from 'node:crypto'
import { writer } from '@/lib/db'
import { reportDoctor } from '@/lib/freshness'
import { clientIp } from '@/lib/request'

const MESSAGES = {
  ok: 'Gracias por ayudar a mantener la lista al día.',
  duplicate: 'Ya habías reportado este perfil. Gracias.',
  not_found: 'Este perfil ya no está disponible.',
  invalid_reason: 'Elige un motivo.',
  rate_limited: 'Ya enviaste muchos reportes hoy. Inténtalo mañana.',
} as const

// Anonymous: the reporter is a salted hash of IP + user agent (no IP stored).
export async function POST(req: Request) {
  const { slug, reason } = await req.json().catch(() => ({}))
  if (typeof slug !== 'string' || typeof reason !== 'string') return Response.json({ error: MESSAGES.invalid_reason }, { status: 400 })
  const fingerprint = createHash('sha256')
    .update(`${process.env.OTP_PEPPER}|${clientIp(req.headers) ?? ''}|${req.headers.get('user-agent') ?? ''}`)
    .digest('hex')
  const result = await reportDoctor(writer(), { slug, reason, fingerprint })
  const ok = result === 'ok' || result === 'duplicate'
  return Response.json(ok ? { message: MESSAGES[result] } : { error: MESSAGES[result] }, { status: ok ? 200 : result === 'rate_limited' ? 429 : 400 })
}
