import nodemailer from 'nodemailer'

// Lowercased address or null. Deliberately simple: the real check is receiving the code.
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

// SMTP_URL: Gmail with an app password today (smtps://user:app-password@smtp.gmail.com:465);
// Resend/SES SMTP once there is a domain. Locally, Mailpit (smtp://localhost:1025).
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  await nodemailer.createTransport(process.env.SMTP_URL).sendMail({ from: process.env.EMAIL_FROM, to, subject, text })
}

export const sendLoginCode = (to: string, code: string) =>
  sendMail(to, `${code} es tu código para entrar al directorio`,
    `Tu código para entrar al directorio de sanitarios en español es:\n\n${code}\n\nCaduca en 10 minutos. Si no lo pediste, ignora este correo.`)

// One-time invitation to doctors imported from the group's list (scripts/invite-imported.ts).
export function inviteEmail({ name, email, slug, site }: { name: string; email: string; slug: string; site: string }) {
  return {
    subject: 'Confirma tu perfil en el directorio de sanitarios en español',
    text: `Hola, ${name}:

Estás en la lista del grupo de sanitarios hispanohablantes de los Emiratos. Con esa lista creamos un directorio
gratuito y comunitario para que los pacientes encuentren profesionales que atienden en español: ${site}

Tu perfil aparece como "Sin confirmar" y solo muestra tu nombre, especialidad y centro.
Para confirmarlo y completarlo (2 minutos), entra aquí con este mismo correo (${email}):

${site}/entrar?medico=${slug}

Te enviaremos un código de acceso: sin contraseñas. Si tus datos cambiaron, podrás corregirlos.

Es un proyecto sin ánimo de lucro y de código abierto: sin anuncios ni perfiles pagados.
Si no quieres aparecer, responde a este correo y retiramos tu perfil.

Directorio de sanitarios en español · Emiratos`,
  }
}
