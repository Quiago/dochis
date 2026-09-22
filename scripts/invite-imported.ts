// One-time "confirm your profile" email to imported (unclaimed) doctors that have an email. Idempotent via invited_at.
//   node scripts/invite-imported.ts --dry-run          → who would get it
//   node scripts/invite-imported.ts --test yo@x.com    → one sample to that address (nobody is marked)
//   node scripts/invite-imported.ts [--limit N]        → send, one every INVITE_DELAY_SECONDS (default 30: Gmail throttles bursts)
import postgres from 'postgres'
import { inviteEmail, sendMail } from '../lib/email.ts'

const args = process.argv.slice(2)
const flag = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] ?? '' }
const site = process.env.NEXT_PUBLIC_SITE_URL!
const delay = Number(process.env.INVITE_DELAY_SECONDS ?? 30) * 1000
const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

const pending = await sql<{ id: string; full_name: string; email: string; slug: string }[]>`
  select id, full_name, email, slug from doctors
  where status = 'unclaimed' and email is not null and invited_at is null
  order by full_name limit ${Number(flag('--limit') ?? 1000)}`

if (args.includes('--dry-run')) {
  console.log(`${pending.length} médicos recibirían la invitación.`)
} else if (flag('--test')) {
  const d = pending[0]
  const m = inviteEmail({ name: d.full_name, email: d.email, slug: d.slug, site })
  await sendMail(flag('--test')!, `[PRUEBA] ${m.subject}`, m.text)
  console.log(`Ejemplo enviado a ${flag('--test')} (con los datos de ${d.slug}).`)
} else {
  let sent = 0
  for (const d of pending) {
    const m = inviteEmail({ name: d.full_name, email: d.email, slug: d.slug, site })
    try {
      await sendMail(d.email, m.subject, m.text)
      await sql`update doctors set invited_at = now() where id = ${d.id}`
      console.log(`${++sent}/${pending.length} ${d.slug}`)
    } catch (e) {
      console.error(`fallo ${d.slug}:`, (e as Error).message)  // not marked: retried on the next run
    }
    if (sent < pending.length) await new Promise((r) => setTimeout(r, delay))
  }
  console.log(`Enviadas ${sent} de ${pending.length}.`)
}
await sql.end()
