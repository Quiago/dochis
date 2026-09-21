import { afterEach, describe, expect, it, vi } from 'vitest'
import { loginChannels } from '@/lib/session'

afterEach(() => vi.unstubAllEnvs())

describe('canales de entrada según la configuración', () => {
  it('solo correo si hay SMTP y falta WhatsApp', () => {
    vi.stubEnv('SMTP_URL', 'smtp://localhost:1025'); vi.stubEnv('WHATSAPP_TOKEN', ''); vi.stubEnv('NEXT_PUBLIC_BOT_NUMBER', '')
    expect(loginChannels()).toEqual(['email'])
  })
  it('WhatsApp primero cuando están los dos', () => {
    vi.stubEnv('SMTP_URL', 'smtp://x'); vi.stubEnv('WHATSAPP_TOKEN', 't'); vi.stubEnv('NEXT_PUBLIC_BOT_NUMBER', '971500000000')
    expect(loginChannels()).toEqual(['whatsapp', 'email'])
  })
  it('WhatsApp necesita token y número del bot', () => {
    vi.stubEnv('SMTP_URL', ''); vi.stubEnv('WHATSAPP_TOKEN', 't'); vi.stubEnv('NEXT_PUBLIC_BOT_NUMBER', '')
    expect(loginChannels()).toEqual([])
  })
})
