// WhatsApp Cloud API (Meta, direct): inbound webhook helpers and service replies. The bot never starts conversations.
import { createHmac, timingSafeEqual } from 'node:crypto'

const GRAPH = 'https://graph.facebook.com/v23.0'

// X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(raw body, app secret).
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest()
  const given = Buffer.from(header.slice(7), 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export type Inbound = { id: string; from: string; text: string }

type Payload = { entry?: { changes?: { value?: { messages?: { id: string; from: string; type: string; text?: { body: string } }[] } }[] }[] }

export function inboundMessages(payload: unknown): Inbound[] {
  return ((payload as Payload).entry ?? [])
    .flatMap((e) => e.changes ?? [])
    .flatMap((c) => c.value?.messages ?? [])
    .filter((m) => m.type === 'text' && m.text)
    .map((m) => ({ id: m.id, from: `+${m.from}`, text: m.text!.body }))
}

export const codeLink = (botNumber: string, code: string) =>
  `https://wa.me/${botNumber}?text=${encodeURIComponent(`CODIGO ${code}`)}`

export async function sendText(toE164: string, body: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: toE164.replace(/^\+/, ''), type: 'text', text: { body } }),
  })
  if (!res.ok) throw new Error(`WhatsApp respondió ${res.status}: ${await res.text()}`)
}
