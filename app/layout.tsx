import type { Metadata, Viewport } from 'next'
import { Button } from '@primer/react'
import Providers from './providers'
import NavDrawer, { type NavItem } from '@/components/NavDrawer'
import { writer } from '@/lib/db'
import { getReviewer } from '@/lib/onboarding'
import { getSession } from '@/lib/session'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Médicos en español · Emiratos', template: '%s · Médicos en español' },
  description:
    'Directorio gratuito y comunitario de médicos que atienden en español en los Emiratos Árabes Unidos. Cada médico mantiene su perfil y confirma sus datos cada tres meses.',
  openGraph: { locale: 'es_ES', type: 'website', siteName: 'Médicos en español · Emiratos' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const reviewer = session && (await getReviewer(writer(), session.phone ?? session.email).catch(() => null))
  const nav: NavItem[] = [
    { href: '/', label: 'Directorio', icon: 'home' },
    { href: '/sobre', label: 'Sobre el proyecto', icon: 'about' },
    { href: '/privacidad', label: 'Privacidad', icon: 'privacy' },
    session ? { href: '/cuenta', label: 'Mi cuenta', icon: 'account' } : { href: '/entrar', label: 'Soy médico: entrar', icon: 'account' },
    ...(reviewer ? [{ href: '/admin', label: 'Panel de revisión', icon: 'admin' } as NavItem] : []),
  ]
  return (
    <html lang="es" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark" suppressHydrationWarning>
      <body>
        <Providers>
          <header className="site-header">
            <div className="site-header-inner">
              <div className="brand-group">
                <NavDrawer items={nav} />
                <a href="/" className="brand">Médicos en español · Emiratos</a>
              </div>
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
