import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Button, Flash, Heading, Link } from '@primer/react'
import ProfileForm, { type Initial } from '@/components/ProfileForm'
import { writer } from '@/lib/db'
import { findDoctorByIdentity, getReviewer, pendingRequestFor } from '@/lib/onboarding'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } }
export const dynamic = 'force-dynamic'

const STATUS_NOTES: Record<string, { variant: 'default' | 'warning' | 'success'; text: string }> = {
  verified: { variant: 'success', text: 'Tu perfil es público. Guardar también confirma tus datos de este mes (se confirman una vez al mes).' },
  stale: { variant: 'warning', text: 'Tu perfil aparece como pendiente porque pasó más de un mes sin confirmar. Revisa tus datos y guarda para confirmarlos.' },
  pending_verification: { variant: 'default', text: 'Tu perfil está en revisión. Un embajador verificará tu licencia; puedes seguir editándolo.' },
  unclaimed: { variant: 'default', text: 'Encontramos tu perfil de la lista anterior del grupo. Complétalo para reclamarlo.' },
  hidden: { variant: 'warning', text: 'Tu perfil está oculto. Revisa tus datos y guarda para enviarlo de nuevo a revisión.' },
}

export default async function Cuenta({ searchParams }: { searchParams: Promise<{ medico?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/entrar')
  const identity = session.phone ?? session.email
  const sql = writer()
  const [own, pending, reviewer] = await Promise.all([findDoctorByIdentity(sql, identity), pendingRequestFor(sql, identity), getReviewer(sql, identity)])
  const { medico } = await searchParams
  const [target] = !own && medico
    ? await sql`select slug, full_name, specialty, clinic, area, emirate from doctors where slug = ${medico} and status in ('unclaimed', 'verified', 'stale')`
    : []

  const note = own ? STATUS_NOTES[own.status] : null
  const claimPending = !own && pending?.kind === 'claim'
  const title = own ? 'Mi perfil' : target ? 'Reclama tu perfil' : 'Crea tu perfil'
  const initial: Initial = own ?? target ?? {}

  return (
    <main className="container account">
      <div className="account-head">
        <Heading as="h1" className="auth-heading">{title}</Heading>
        <p className="muted small center">Entraste con {session.phone ? 'el número' : 'el correo'} <strong>{identity}</strong></p>
        {reviewer && <p className="center small"><Link href="/admin">Panel de revisión</Link></p>}
      </div>

      {claimPending ? (
        <Flash>Tu solicitud para reclamar el perfil de <strong>{pending.doctor_name}</strong> está en revisión. Te avisaremos en el grupo cuando esté lista.</Flash>
      ) : (
        <>
          {note && <Flash variant={note.variant} className="auth-flash">{note.text}</Flash>}
          {!own && target && <Flash className="auth-flash">Completa tus datos. El perfil de {target.full_name} no cambia hasta que un embajador verifique tu licencia.</Flash>}
          {!own && !target && <p className="muted">No encontramos un perfil con tu {session.phone ? 'número' : 'correo'}. Completa tus datos para aparecer en el directorio.</p>}
          <div className="auth-box">
            <ProfileForm initial={initial} medico={!own ? target?.slug : undefined} loginPhone={session.phone} submitLabel={own ? 'Guardar perfil' : 'Enviar perfil'} />
          </div>
          {own?.status === 'verified' && <p className="center small"><Link href={`/medico/${own.slug}`}>Ver mi perfil público</Link></p>}
        </>
      )}

      <form action="/api/auth/logout" method="post" className="center">
        <Button type="submit" variant="invisible" size="small">Cerrar sesión</Button>
      </form>
    </main>
  )
}
