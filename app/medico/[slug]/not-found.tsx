import { Heading, Link } from '@primer/react'

export default function NotFound() {
  return (
    <main className="container narrow center">
      <Heading as="h1">No encontramos este perfil</Heading>
      <p className="muted">Puede que ya no esté en el directorio.</p>
      <p><Link href="/">Volver al directorio</Link></p>
    </main>
  )
}
