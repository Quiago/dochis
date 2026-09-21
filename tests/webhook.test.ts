import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verify = vi.fn()
const send = vi.fn()
vi.mock('@/lib/db', () => ({ writer: () => 'sql' }))
vi.mock('@/lib/auth', () => ({ verifyFromWhatsApp: (...a: unknown[]) => verify(...a) }))
vi.mock('@/lib/whatsapp', async (orig) => ({ ...(await orig<object>()), sendText: (...a: unknown[]) => send(...a) }))

const { GET, POST } = await import('@/app/api/whatsapp/webhook/route')
const { clientIp } = await import('@/lib/request')

const SECRET = 'app-secret'
const payload = (id: string, body: string) =>
  JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from: '971501234567', type: 'text', text: { body } }] } }] }] })
const post = (raw: string, secret = SECRET) =>
  POST(new Request('https://x/api/whatsapp/webhook', {
    method: 'POST', body: raw,
    headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}` },
  }))

beforeEach(() => {
  vi.stubEnv('WHATSAPP_APP_SECRET', SECRET)
  vi.stubEnv('WHATSAPP_VERIFY_TOKEN', 'verify-me')
  vi.stubEnv('OTP_PEPPER', 'pepper')
  verify.mockReset(); send.mockReset()
})

describe('webhook de WhatsApp', () => {
  it('responde al desafío de verificación de Meta solo con el token correcto', async () => {
    const ok = await GET(new Request('https://x/w?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42'))
    expect(ok.status).toBe(200)
    expect(await ok.text()).toBe('42')
    expect((await GET(new Request('https://x/w?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=42'))).status).toBe(403)
  })

  it('rechaza cuerpos sin firma válida y no procesa nada', async () => {
    const res = await post(payload('m1', 'CODIGO 123456'), 'otro-secreto')
    expect(res.status).toBe(401)
    expect(verify).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('verifica el código con el remitente y responde "Listo"', async () => {
    verify.mockResolvedValue('verified')
    expect((await post(payload('m2', 'CODIGO 123456'))).status).toBe(200)
    expect(verify).toHaveBeenCalledWith('sql', { from: '+971501234567', code: '123456', pepper: 'pepper' })
    expect(send).toHaveBeenCalledWith('+971501234567', 'Listo, ya puedes volver a la web.')
  })

  it('ignora reintentos del mismo mensaje', async () => {
    verify.mockResolvedValue('verified')
    await post(payload('m3', 'CODIGO 123456'))
    await post(payload('m3', 'CODIGO 123456'))
    expect(verify).toHaveBeenCalledTimes(1)
  })

  it('los mensajes que no son código van al router del bot', async () => {
    await post(payload('m4', 'AYUDA'))
    expect(verify).not.toHaveBeenCalled()
    expect(send.mock.calls[0][1]).toMatch(/directorio/i)
  })

  it('un fallo al responder no rompe el webhook (Meta necesita 200)', async () => {
    verify.mockResolvedValue('wrong_code')
    send.mockRejectedValue(new Error('graph caído'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await post(payload('m5', 'CODIGO 000000'))).status).toBe(200)
  })
})

describe('IP del visitante', () => {
  it('usa CloudFront-Viewer-Address (IPv4 e IPv6) y si no, x-forwarded-for', () => {
    expect(clientIp(new Headers({ 'cloudfront-viewer-address': '203.0.113.7:51234' }))).toBe('203.0.113.7')
    expect(clientIp(new Headers({ 'cloudfront-viewer-address': '2001:db8::1:443' }))).toBe('2001:db8::1')
    expect(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))).toBe('198.51.100.1')
    expect(clientIp(new Headers())).toBeNull()
  })

  it('confía en x-client-ip del proxy de Cloudflare solo con el secreto correcto', () => {
    vi.stubEnv('PROXY_SECRET', 'proxy-secret')
    const cf = { 'cloudfront-viewer-address': '172.70.1.1:443', 'x-client-ip': '198.51.100.9' }
    expect(clientIp(new Headers({ ...cf, 'x-proxy-secret': 'proxy-secret' }))).toBe('198.51.100.9')
    expect(clientIp(new Headers({ ...cf, 'x-proxy-secret': 'falso' }))).toBe('172.70.1.1')
    expect(clientIp(new Headers(cf))).toBe('172.70.1.1')
    vi.stubEnv('PROXY_SECRET', '')
    expect(clientIp(new Headers({ ...cf, 'x-proxy-secret': '' }))).toBe('172.70.1.1')
  })
})
