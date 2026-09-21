import type { Metadata } from 'next'
import { Button, Heading } from '@primer/react'
import { CheckCircleIcon, DownloadIcon } from '@primer/octicons-react'

export const metadata: Metadata = { title: 'Perfil guardado', robots: { index: false } }

const MESSAGES: Record<string, { title: string; text: string }> = {
  saved: { title: 'Perfil guardado', text: 'Tus datos quedaron confirmados por este mes. Gracias por mantener la lista al día.' },
  pending: { title: 'Perfil enviado', text: 'Un embajador revisará tu licencia en el registro oficial. Verás el estado la próxima vez que entres.' },
  claim: { title: 'Solicitud enviada', text: 'Un embajador revisará tu licencia antes de pasarte el perfil. Verás el estado la próxima vez que entres.' },
}

export default async function Listo({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const m = MESSAGES[(await searchParams).estado ?? ''] ?? MESSAGES.pending
  return (
    <main className="container auth center">
      <CheckCircleIcon size={40} className="success-icon" />
      <Heading as="h1" className="auth-heading">{m.title}</Heading>
      <p className="muted">{m.text}</p>
      <div className="auth-box">
        <p><strong>Guarda el contacto del directorio</strong> para recibir los recordatorios. Cada mes te pediremos confirmar tus datos: solo tendrás que responder un mensaje.</p>
        <Button as="a" href="/contacto.vcf" download leadingVisual={<DownloadIcon />} block>Guardar contacto</Button>
      </div>
      <Button as="a" href="/cuenta" variant="primary" block>Listo</Button>
    </main>
  )
}
