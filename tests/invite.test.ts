import { describe, expect, it } from 'vitest'
import { inviteEmail } from '@/lib/email'

describe('correo de primera confirmación', () => {
  const m = inviteEmail({ name: 'Inmaculada Cerecedo', email: 'cerecei@ccad.ae', slug: 'inmaculada-cerecedo', site: 'https://dochis.pages.dev' })

  it('saluda por el nombre y enlaza a su perfil para confirmarlo', () => {
    expect(m.subject).toMatch(/perfil/i)
    expect(m.text).toContain('Hola, Inmaculada Cerecedo')
    expect(m.text).toContain('https://dochis.pages.dev/entrar?medico=inmaculada-cerecedo')
    expect(m.text).toContain('cerecei@ccad.ae')
  })

  it('explica de dónde salen los datos, qué es público y cómo darse de baja', () => {
    expect(m.text).toMatch(/lista del grupo/i)
    expect(m.text).toMatch(/nombre, especialidad y centro/i)
    expect(m.text).toMatch(/responde a este correo/i)
    expect(m.text).toMatch(/gratuito/i)
  })
})
