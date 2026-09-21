import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Button, Heading } from '@primer/react'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } }
export const dynamic = 'force-dynamic'

// ponytail: placeholder until Phase 3 (claim profile / sign-up).
export default async function Cuenta() {
  const session = await getSession()
  if (!session) redirect('/entrar')
  return (
    <main className="container auth">
      <Heading as="h1" className="auth-heading">Mi cuenta</Heading>
      <div className="auth-box">
        <p>Entraste con {session.phone ? 'el número' : 'el correo'} <strong>{session.phone ?? session.email}</strong>.</p>
        <p className="muted">Muy pronto podrás reclamar tu perfil o crearlo desde aquí.</p>
        <form action="/api/auth/logout" method="post">
          <Button type="submit" block>Cerrar sesión</Button>
        </form>
      </div>
    </main>
  )
}
