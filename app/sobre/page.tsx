import type { Metadata } from 'next'
import { Heading, Link } from '@primer/react'

export const metadata: Metadata = { title: 'Sobre el proyecto', description: 'Directorio comunitario, gratuito y de código abierto de profesionales de la salud que atienden en español en los Emiratos.' }

export default function Sobre() {
  return (
    <main className="container prose">
      <Heading as="h1">Sobre el proyecto</Heading>
      <p>Este directorio nace de un grupo de WhatsApp de unos 350 sanitarios hispanohablantes en los Emiratos, cuya lista en una hoja de cálculo se mantenía a mano y quedaba desactualizada.</p>
      <h2>Cómo funciona</h2>
      <ul>
        <li><strong>Cada profesional es dueño de su perfil.</strong> Nadie mantiene los datos a mano.</li>
        <li><strong>Frescura visible.</strong> Cada profesional confirma sus datos una vez al mes y su perfil muestra cuándo lo hizo. Si pasa más de un mes sin confirmar, aparece como &quot;pendiente&quot;; a los tres meses se oculta.</li>
        <li><strong>Justicia en la visibilidad.</strong> El orden es aleatorio en cada visita. No hay rankings ni perfiles destacados.</li>
        <li><strong>Filtramos por idioma, no por nacionalidad.</strong></li>
        <li><strong>Licencias comprobables.</strong> Cada profesional declara su número de licencia y lo mostramos con un enlace al registro oficial de la DHA, DOH o MOHAP, para que cualquiera pueda comprobarlo. Una revisión automática detecta licencias repetidas y perfiles sospechosos, y la comunidad puede reportar con &quot;Ya no está aquí&quot;.</li>
      </ul>
      <h2>Gratis, siempre</h2>
      <p>Es un proyecto pro-bono: gratis para profesionales y pacientes, sin anuncios, sin perfiles pagados y sin venta de datos. El código es abierto (licencia GPL-3.0) y está en <Link href="https://github.com/Quiago/dochis">GitHub</Link>.</p>
      <h2>Contacto</h2>
      <p>Si ves un error o quieres ser embajador de tu especialidad, escríbenos a <Link href="mailto:dochispanic@gmail.com">dochispanic@gmail.com</Link>.</p>
    </main>
  )
}
