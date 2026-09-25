import { vcard } from '@/lib/vcard'

export function GET() {
  const email = process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? process.env.EMAIL_FROM ?? ''
  const body = vcard({
    name: 'Directorio Sanitarios en español',
    phone: process.env.NEXT_PUBLIC_BOT_NUMBER ?? '',
    email,
    url: process.env.NEXT_PUBLIC_SITE_URL ?? '',
  })
  return new Response(body, {
    headers: { 'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': 'attachment; filename="directorio-sanitarios.vcf"' },
  })
}
