import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Heading } from '@primer/react'
import LoginFlow from '@/components/LoginFlow'
import { getDoctorBySlug } from '@/lib/doctors'
import { getSession, loginChannels } from '@/lib/session'

export const metadata: Metadata = { title: 'Entrar', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function Entrar({ searchParams }: { searchParams: Promise<{ medico?: string }> }) {
  const { medico } = await searchParams
  const next = medico ? `/cuenta?medico=${encodeURIComponent(medico)}` : '/cuenta'
  if (await getSession()) redirect(next)
  const doctor = medico ? (await getDoctorBySlug(medico).catch(() => null))?.doctor : null
  const intro = doctor
    ? `Para confirmar que eres ${doctor.full_name}, entra con tu WhatsApp o tu correo.`
    : 'Si ya estás en la lista, verás tu perfil; si no, podrás crearlo.'

  return (
    <main className="container auth">
      <Heading as="h1" className="auth-heading">Entrar al directorio</Heading>
      <div className="auth-box">
        <LoginFlow next={next} intro={intro} channels={loginChannels()} />
      </div>
      <p className="muted small center">Solo usamos tu número o correo para identificarte. No se publican sin tu permiso.</p>
    </main>
  )
}
