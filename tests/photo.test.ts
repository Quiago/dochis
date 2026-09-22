import { describe, expect, it, vi } from 'vitest'
import { photoIssue, validatePhoto } from '@/lib/photo'

const jpeg = (n = 100) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(n).fill(0)])
const webp = () => new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), 0, 0])

describe('validación de la foto', () => {
  it('acepta JPEG y WebP reconocidos por sus bytes, no por lo que dice el navegador', () => {
    expect(validatePhoto(jpeg())).toEqual({ type: 'image/jpeg' })
    expect(validatePhoto(webp())).toEqual({ type: 'image/webp' })
  })
  it('rechaza otros formatos (p. ej. SVG o HTML disfrazados) y archivos grandes', () => {
    expect(validatePhoto(new TextEncoder().encode('<svg onload=alert(1)>'))).toHaveProperty('error')
    expect(validatePhoto(new TextEncoder().encode('<html>'))).toHaveProperty('error')
    expect(validatePhoto(jpeg(250_000))).toHaveProperty('error')
    expect(validatePhoto(new Uint8Array())).toHaveProperty('error')
  })
})

describe('revisión de la foto con Bedrock (simulada)', () => {
  it('rechaza lo que el modelo marca como inapropiado, con el motivo', async () => {
    const invoke = vi.fn().mockResolvedValue('{"apropiada": false, "motivo": "Contiene publicidad"}')
    expect(await photoIssue(jpeg(), 'image/jpeg', invoke)).toBe('Contiene publicidad')
  })
  it('acepta retratos, logos o iconos', async () => {
    expect(await photoIssue(jpeg(), 'image/jpeg', vi.fn().mockResolvedValue('{"apropiada": true}'))).toBeNull()
  })
  it('si el modelo falla o no hay modelo configurado, no bloquea', async () => {
    expect(await photoIssue(jpeg(), 'image/jpeg', vi.fn().mockRejectedValue(new Error('x')))).toBeNull()
    vi.stubEnv('PHOTO_MODEL_ID', '')
    expect(await photoIssue(jpeg(), 'image/jpeg')).toBeNull()
    vi.unstubAllEnvs()
  })
})
