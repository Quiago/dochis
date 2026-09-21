import nodemailer from 'nodemailer'

// Lowercased address or null. Deliberately simple: the real check is receiving the code.
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

// SMTP_URL: Gmail with an app password today (smtps://user:app-password@smtp.gmail.com:465);
// Resend/SES SMTP once there is a domain. Locally, Mailpit (smtp://localhost:1025).
export async function sendLoginCode(to: string, code: string): Promise<void> {
  const transport = nodemailer.createTransport(process.env.SMTP_URL)
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `${code} es tu código para entrar al directorio`,
    text: `Tu código para entrar al directorio de médicos en español es:\n\n${code}\n\nCaduca en 10 minutos. Si no lo pediste, ignora este correo.`,
  })
}
