import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Button, Flash, Heading, Link } from '@primer/react'
import InviteColleague from '@/components/InviteColleague'
import ProfileForm, { type Initial } from '@/components/ProfileForm'
import { writer } from '@/lib/db'
import { findDoctorByIdentity, getReviewer } from '@/lib/onboarding'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } }
export const dynamic = 'force-dynamic'

const STATUS_NOTES: Record<string, { variant: 'default' | 'warning' | 'success'; text: string }> = {
  verified: { variant: 'success', text: 'Tu perfil es público. Guardar también confirma tus datos de este mes (se confirman una vez al mes).' },
  stale: { variant: 'warning', text: 'Tu perfil aparece como pendiente porque pasó más de un mes sin confirmar. Revisa tus datos y guarda para confirmarlos.' },
  pending_verification: { variant: 'default', text: 'Tu perfil está en revisión porque la revisión automática encontró algo que conviene mirar. Puedes corregirlo y guardar de nuevo.' },
  unclaimed: { variant: 'default', text: 'Encontramos tu perfil de la lista anterior del grupo. Complétalo para publicarlo.' },
  hidden: { variant: 'warning', text: 'Tu perfil está oculto. Revisa tus datos y guarda para enviarlo de nuevo a revisión.' },
}

export default async function Cuenta({ searchParams }: { searchParams: Promise<{ medico?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/entrar')
  const identity = session.phone ?? session.email
  const sql = writer()
  const [own, reviewer] = await Promise.all([findDoctorByIdentity(sql, identity), getReviewer(sql, identity)])
  const { medico } = await searchParams
  const [target] = !own && medico
    ? await sql`select slug, full_name, specialty, clinic, area, emirate from doctors where slug = ${medico} and status in ('unclaimed', 'verified', 'stale')`
    : []

  const note = own ? STATUS_NOTES[own.status] : null
  const title = own ? 'Mi perfil' : 'Crea tu perfil'
  const initial: Initial = own ?? target ?? {}

  return (
    <main className="container account">
      <div className="account-head">
        <Heading as="h1" className="auth-heading">{title}</Heading>
        <p className="muted small center">Entraste con {session.phone ? 'el número' : 'el correo'} <strong>{identity}</strong></p>
        {reviewer && <p className="center small"><Link href="/admin">Panel de revisión</Link></p>}
      </div>

      {reviewer && !own ? (
        <>
          <Flash className="auth-flash">Eres {reviewer.role === 'admin' ? 'administrador' : 'embajador'}: no necesitas un perfil de profesional. Tu panel está en <Link href="/admin">Panel de revisión</Link>.</Flash>
          {/* Folded so an admin never republishes themselves by accident. */}
          <details className="auth-box">
            <summary>¿También atiendes pacientes? Crea tu perfil</summary>
            <ProfileForm initial={initial} loginPhone={session.phone} submitLabel="Publicar perfil" />
          </details>
        </>
      ) : (
        <>
      {note && <Flash variant={note.variant} className="auth-flash">{note.text}</Flash>}
      {!own && target && <Flash className="auth-flash">Rellenamos lo que teníamos de la lista del grupo. Complétalo y guarda: se publicará como tu perfil.</Flash>}
      {!own && !target && <p className="muted">No encontramos un perfil con tu {session.phone ? 'número' : 'correo'}. Completa tus datos para aparecer en el directorio.</p>}
      <div className="auth-box">
          <ProfileForm initial={initial} loginPhone={session.phone} submitLabel={own ? 'Guardar perfil' : 'Publicar perfil'}
            photo={own?.photo_updated_at && own.photo ? `/cuenta/foto?v=${new Date(own.photo_updated_at).getTime()}` : undefined} />
      </div>
      {own?.status === 'verified' && <p className="center small"><Link href={`/medico/${own.slug}`}>Ver mi perfil público</Link></p>}

        </>
      )}
      <div className="auth-box">
        <p><strong>Invita a un colega</strong> que atienda en español.</p>
        <InviteColleague url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/entrar`} />
      </div>

      <form action="/api/auth/logout" method="post" className="center">
        <Button type="submit" variant="invisible" size="small">Cerrar sesión</Button>
      </form>
    </main>
  )
}
