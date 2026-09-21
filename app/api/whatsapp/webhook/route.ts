import { verifyFromWhatsApp } from '@/lib/auth'
import { botReply } from '@/lib/bot'
import { writer } from '@/lib/db'
import { parseCodeMessage } from '@/lib/otp'
import { inboundMessages, sendText, verifySignature } from '@/lib/whatsapp'

const REPLIES = {
  verified: 'Listo, ya puedes volver a la web.',
  wrong_code: 'Ese código no coincide. Revisa el que aparece en la web.',
  no_challenge: 'No encontramos un inicio de sesión pendiente para este número. Pide un código nuevo en la web.',
} as const

// Meta retries deliveries; skip message ids already handled.
// ponytail: in-memory, single instance; move to a table if the app ever runs on more than one server.
const seen = new Set<string>()

// Meta's one-time webhook verification.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET ?? '')) {
    return new Response('Invalid signature', { status: 401 })
  }
  for (const msg of inboundMessages(JSON.parse(raw))) {
    if (seen.has(msg.id)) continue
    seen.add(msg.id)
    if (seen.size > 5000) seen.clear()
    try {
      const code = parseCodeMessage(msg.text)
      const reply = code
        ? REPLIES[await verifyFromWhatsApp(writer(), { from: msg.from, code, pepper: process.env.OTP_PEPPER! })]
        : botReply(msg.text)
      await sendText(msg.from, reply)
    } catch (e) {
      console.error('webhook', msg.id, e)
    }
  }
  // Always 200 for signed payloads: Meta disables webhooks that keep failing.
  return new Response('OK', { status: 200 })
}
