import type { Metadata, Viewport } from 'next'
import { Button } from '@primer/react'
import Providers from './providers'
import { getSession } from '@/lib/session'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Médicos en español · Emiratos', template: '%s · Médicos en español' },
  description:
    'Directorio gratuito y comunitario de médicos que atienden en español en los Emiratos Árabes Unidos. Cada médico confirma sus datos por WhatsApp.',
  openGraph: { locale: 'es_ES', type: 'website', siteName: 'Médicos en español · Emiratos' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <html lang="es" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark" suppressHydrationWarning>
      <body>
        <Providers>
          <header className="site-header">
            <div className="site-header-inner">
              <a href="/" className="brand">Médicos en español · Emiratos</a>
              {session
                ? <Button as="a" href="/cuenta" size="small">Mi cuenta</Button>
                : <Button as="a" href="/entrar" size="small">Soy médico: entrar</Button>}
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  )
}
