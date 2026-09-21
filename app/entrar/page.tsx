import type { Metadata } from 'next'
import { Heading, Link } from '@primer/react'

export const metadata: Metadata = { title: 'Entrar con WhatsApp', robots: { index: false } }

// ponytail: placeholder until Phase 2 (reverse-OTP login).
export default function Entrar() {
  return (
    <main className="container narrow center">
      <Heading as="h1">Entrar con WhatsApp</Heading>
      <p className="muted">Muy pronto podrás entrar con tu número de WhatsApp, sin contraseñas ni correos.</p>
      <p><Link href="/">Volver al directorio</Link></p>
    </main>
  )
}
