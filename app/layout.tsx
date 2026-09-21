import type { Metadata, Viewport } from 'next'
import Providers from './providers'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Médicos en español · Emiratos', template: '%s · Médicos en español' },
  description:
    'Directorio gratuito y comunitario de médicos que atienden en español en los Emiratos Árabes Unidos. Cada médico confirma sus datos por WhatsApp.',
  openGraph: { locale: 'es_ES', type: 'website', siteName: 'Médicos en español · Emiratos' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
