import type { Metadata } from 'next'
import { Button, Heading } from '@primer/react'
import { CheckCircleIcon } from '@primer/octicons-react'
import IconBtn from '@/components/IconBtn'
import InviteColleague from '@/components/InviteColleague'
import { loginChannels } from '@/lib/session'

export const metadata: Metadata = { title: 'Perfil guardado', robots: { index: false } }

const MESSAGES: Record<string, { title: string; text: string }> = {
  saved: { title: 'Perfil guardado', text: 'Tus datos quedaron confirmados por este mes. Gracias por mantener la lista al día.' },
  published: { title: 'Perfil publicado', text: 'Ya apareces en el directorio. Cada mes te pediremos confirmar tus datos.' },
  pending: { title: 'Perfil en revisión', text: 'La revisión automática encontró algo que conviene mirar (por ejemplo, una licencia que ya está en otro perfil). Te avisaremos cuando esté publicado.' },
}

export default async function Listo({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const m = MESSAGES[(await searchParams).estado ?? ''] ?? MESSAGES.pending
  return (
    <main className="container auth center">
      <CheckCircleIcon size={40} className="success-icon" />
      <Heading as="h1" className="auth-heading">{m.title}</Heading>
      <p className="muted">{m.text}</p>
      {/* The contact card only matters for WhatsApp broadcast reminders. */}
      {loginChannels().includes('whatsapp') && (
        <div className="auth-box">
          <p><strong>Guarda el contacto del directorio</strong> para recibir los recordatorios. Cada mes te pediremos confirmar tus datos: solo tendrás que responder un mensaje.</p>
          <IconBtn as="a" href="/contacto.vcf" download iconName="download" block>Guardar contacto</IconBtn>
        </div>
      )}
      <div className="auth-box">
        <p><strong>¿Conoces a otro profesional que atienda en español?</strong> Invítalo: cuantos más estemos, más útil es el directorio.</p>
        <InviteColleague url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/entrar`} />
      </div>
      <Button as="a" href="/cuenta" variant="primary" block>Listo</Button>
    </main>
  )
}
