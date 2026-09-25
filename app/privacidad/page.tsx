import type { Metadata } from 'next'
import { Heading, Link } from '@primer/react'

export const metadata: Metadata = { title: 'Privacidad', description: 'Qué datos guarda el directorio, para qué y cómo borrarlos.' }

export default function Privacidad() {
  return (
    <main className="container prose">
      <Heading as="h1">Privacidad</Heading>
      <p>Tratamos los datos siguiendo la ley de protección de datos de los Emiratos (PDPL) y un principio simple: guardar lo mínimo y publicar solo lo que el profesional acepta.</p>
      <h2>Qué es público</h2>
      <ul>
        <li>Nombre, especialidad, clínica, zona, emirato, idiomas, seguros aceptados, autoridad y fecha de la última confirmación.</li>
        <li>El WhatsApp del profesional, <strong>solo</strong> si marcó la casilla para mostrarlo a los pacientes.</li>
        <li>El correo de contacto y los enlaces, solo si el profesional los escribió en su perfil.</li>
        <li>El horario de atención, si lo publicó.</li>
        <li>El número de licencia, solo si marcó la casilla de publicarlo. Si no, se indica únicamente la autoridad en la que está registrado.</li>
        <li>La foto o el icono del profesional, solo si la subió.</li>
        <li>Los perfiles importados de la lista anterior del grupo muestran solo nombre, especialidad, clínica, zona y emirato hasta que el profesional los reclama.</li>
      </ul>
      <h2>Qué no se publica nunca</h2>
      <ul>
        <li>El teléfono con el que el profesional entra.</li>
        <li>El correo con el que entra, que es distinto del correo de contacto y nunca se publica.</li>
      </ul>
      <h2>Para qué usamos los datos</h2>
      <ul>
        <li>Identificar al profesional al entrar (le enviamos un código de un solo uso).</li>
        <li>Pedirle que confirme sus datos una vez al mes.</li>
        <li>Revisar automáticamente cada perfil nuevo (licencias repetidas, spam). Esa revisión puede usar un modelo de IA de Amazon Bedrock que solo recibe los datos profesionales del formulario, nunca el teléfono ni el correo.</li>
        <li>Evitar abusos: los reportes &quot;Ya no está aquí&quot; se guardan con una huella anónima, sin la dirección IP.</li>
      </ul>
      <p>No hay anuncios, no vendemos ni compartimos datos y no usamos cookies de seguimiento. Solo una cookie técnica para mantener la sesión.</p>
      <h2>Tus derechos</h2>
      <p>Puedes corregir tus datos desde <Link href="/cuenta">Mi cuenta</Link>. Para borrar tu perfil o pedir una copia de tus datos, escribe a <Link href="mailto:dochispanic@gmail.com">dochispanic@gmail.com</Link>.</p>
    </main>
  )
}
