import type { Metadata } from 'next'
import { Heading, Link } from '@primer/react'

export const metadata: Metadata = { title: 'Privacidad', description: 'Qué datos guarda el directorio, para qué y cómo borrarlos.' }

export default function Privacidad() {
  return (
    <main className="container prose">
      <Heading as="h1">Privacidad</Heading>
      <p>Tratamos los datos siguiendo la ley de protección de datos de los Emiratos (PDPL) y un principio simple: guardar lo mínimo y publicar solo lo que el médico acepta.</p>
      <h2>Qué es público</h2>
      <ul>
        <li>Nombre, especialidad, clínica, zona, emirato, idiomas, seguros aceptados, autoridad y número de licencia (para poder comprobarla en el registro oficial) y fecha de la última confirmación.</li>
        <li>El WhatsApp del médico, <strong>solo</strong> si marcó la casilla para mostrarlo a los pacientes.</li>
        <li>Los perfiles importados de la lista anterior del grupo muestran solo nombre, especialidad y centro hasta que el médico los reclama.</li>
      </ul>
      <h2>Qué no se publica nunca</h2>
      <ul>
        <li>El teléfono o correo con el que el médico entra.</li>
              </ul>
      <h2>Para qué usamos los datos</h2>
      <ul>
        <li>Identificar al médico al entrar (le enviamos un código de un solo uso).</li>
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
