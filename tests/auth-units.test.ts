import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAllowedPhone, toE164 } from '@/lib/phone'
import { codesMatch, generateCode, hashCode, parseCodeMessage } from '@/lib/otp'
import { codeLink, inboundMessages, sendText, verifySignature } from '@/lib/whatsapp'
import { createSessionToken, readSessionToken } from '@/lib/session'
import { botReply } from '@/lib/bot'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('teléfonos', () => {
  it('normaliza a E.164 con EAU como país por defecto', () => {
    expect(toE164('+971 50 123 4567')).toBe('+971501234567')
    expect(toE164('050 123 4567')).toBe('+971501234567')
    expect(toE164('00971501234567')).toBe('+971501234567')
    expect(toE164('+34 612 34 56 78')).toBe('+34612345678')
  })

  it('rechaza números inválidos', () => {
    expect(toE164('123')).toBeNull()
    expect(toE164('hola')).toBeNull()
    expect(toE164('')).toBeNull()
  })

  it('solo permite los prefijos configurados', () => {
    expect(isAllowedPhone('+971501234567', '+971')).toBe(true)
    expect(isAllowedPhone('+34612345678', '+971')).toBe(false)
    expect(isAllowedPhone('+34612345678', '+971,+34')).toBe(true)
  })
})

describe('códigos', () => {
  it('genera 6 dígitos', () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/)
  })

  it('el hash depende del pepper y la comparación es exacta', () => {
    const h = hashCode('123456', 'pepper')
    expect(h).not.toContain('123456')
    expect(codesMatch('123456', h, 'pepper')).toBe(true)
    expect(codesMatch('123457', h, 'pepper')).toBe(false)
    expect(codesMatch('123456', h, 'otro')).toBe(false)
  })

  it('reconoce el mensaje prellenado con variantes razonables', () => {
    expect(parseCodeMessage('CODIGO 123456')).toBe('123456')
    expect(parseCodeMessage('  código   123456 ')).toBe('123456')
    expect(parseCodeMessage('Codigo: 123456')).toBe('123456')
    expect(parseCodeMessage('CODIGO 12345')).toBeNull()
    expect(parseCodeMessage('hola 123456')).toBeNull()
  })
})

describe('WhatsApp Cloud API', () => {
  const body = JSON.stringify({ entry: [] })
  const sign = (b: string, s: string) => `sha256=${createHmac('sha256', s).update(b).digest('hex')}`

  it('verifica la firma X-Hub-Signature-256 sobre el cuerpo crudo', () => {
    expect(verifySignature(body, sign(body, 'secret'), 'secret')).toBe(true)
    expect(verifySignature(body, sign(body, 'otro'), 'secret')).toBe(false)
    expect(verifySignature(body + ' ', sign(body, 'secret'), 'secret')).toBe(false)
    expect(verifySignature(body, null, 'secret')).toBe(false)
    expect(verifySignature(body, 'sha256=corto', 'secret')).toBe(false)
  })

  it('extrae los mensajes de texto entrantes con el remitente en E.164', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: {
        messages: [
          { from: '971501234567', id: 'wamid.1', type: 'text', text: { body: 'CODIGO 123456' } },
          { from: '971501234567', id: 'wamid.2', type: 'image', image: {} },
        ],
      } }, { field: 'messages', value: { statuses: [{ id: 'x', status: 'delivered' }] } }] }],
    }
    expect(inboundMessages(payload)).toEqual([{ id: 'wamid.1', from: '+971501234567', text: 'CODIGO 123456' }])
    expect(inboundMessages({})).toEqual([])
  })

  it('arma el enlace wa.me con el código prellenado', () => {
    expect(codeLink('971500000000', '123456')).toBe('https://wa.me/971500000000?text=CODIGO%20123456')
  })

  it('envía texto con la Graph API usando el token', async () => {
    vi.stubEnv('WHATSAPP_TOKEN', 'tok')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '999')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await sendText('+971501234567', 'Hola')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/graph\.facebook\.com\/v\d+\.\d+\/999\/messages$/)
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toMatchObject({ messaging_product: 'whatsapp', to: '971501234567', type: 'text', text: { body: 'Hola' } })
  })
})

describe('sesión', () => {
  it('firma y lee el token; rechaza manipulados o con otro secreto', async () => {
    vi.stubEnv('SESSION_SECRET', 'a'.repeat(32))
    const token = await createSessionToken('+971501234567')
    expect(await readSessionToken(token)).toEqual({ phone: '+971501234567' })
    expect(await readSessionToken(token.slice(0, -2) + 'xx')).toBeNull()
    expect(await readSessionToken('basura')).toBeNull()
    vi.stubEnv('SESSION_SECRET', 'b'.repeat(32))
    expect(await readSessionToken(token)).toBeNull()
  })

  it('falla si el secreto es corto', async () => {
    vi.stubEnv('SESSION_SECRET', 'corto')
    await expect(createSessionToken('+971501234567')).rejects.toThrow(/SESSION_SECRET/)
  })
})

describe('bot', () => {
  it('responde a los comandos y ayuda por defecto', () => {
    expect(botReply('AYUDA')).toMatch(/directorio/i)
    expect(botReply('confirmar')).toMatch(/pronto/i)
    expect(botReply('lo que sea')).toMatch(/AYUDA/)
  })
})
