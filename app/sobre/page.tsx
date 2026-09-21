import type { Metadata } from 'next'
import { Heading, Link } from '@primer/react'

export const metadata: Metadata = { title: 'Sobre el proyecto', description: 'Directorio comunitario, gratuito y de código abierto de médicos que atienden en español en los Emiratos.' }

export default function Sobre() {
  return (
    <main className="container prose">
      <Heading as="h1">Sobre el proyecto</Heading>
      <p>Este directorio nace de un grupo de WhatsApp de unos 350 sanitarios hispanohablantes en los Emiratos, cuya lista en una hoja de cálculo se mantenía a mano y quedaba desactualizada.</p>
      <h2>Cómo funciona</h2>
      <ul>
        <li><strong>Cada médico es dueño de su perfil.</strong> Nadie mantiene los datos a mano.</li>
        <li><strong>Frescura visible.</strong> Cada perfil muestra cuándo se confirmó. Sin confirmación en 90 días pasa a &quot;pendiente&quot;.</li>
        <li><strong>Justicia en la visibilidad.</strong> El orden es aleatorio en cada visita. No hay rankings ni perfiles destacados.</li>
        <li><strong>Filtramos por idioma, no por nacionalidad.</strong></li>
        <li><strong>Licencias verificadas.</strong> Embajadores voluntarios comprueban cada licencia en el registro oficial de la DHA, DOH o MOHAP.</li>
      </ul>
      <h2>Gratis, siempre</h2>
      <p>Es un proyecto pro-bono: gratis para médicos y pacientes, sin anuncios, sin perfiles pagados y sin venta de datos. El código es abierto (licencia GPL-3.0) y está en <Link href="https://github.com/Quiago/dochis">GitHub</Link>.</p>
      <h2>Contacto</h2>
      <p>Si ves un error o quieres ser embajador de tu especialidad, escríbenos a <Link href="mailto:dochispanic@gmail.com">dochispanic@gmail.com</Link>.</p>
    </main>
  )
}
