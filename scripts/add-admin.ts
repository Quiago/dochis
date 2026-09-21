// Adds or updates an admin/ambassador. Usage:
//   node --env-file=.env.local scripts/add-admin.ts <phone-or-email> [admin|ambassador] [specialty]
// In production (EC2): set -a; . /etc/dochis.env; set +a; node scripts/add-admin.ts ...
import postgres from 'postgres'
import { normalizeEmail } from '../lib/email.ts'
import { toE164 } from '../lib/phone.ts'

const [raw, role = 'admin', scope = null] = process.argv.slice(2)
const identity = raw?.includes('@') ? normalizeEmail(raw) : raw && toE164(raw)
if (!identity || !['admin', 'ambassador'].includes(role)) {
  console.error('Uso: node scripts/add-admin.ts <teléfono-o-correo> [admin|ambassador] [especialidad]')
  process.exit(1)
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
await sql`
  insert into admins (identity, role, scope) values (${identity}, ${role}, ${scope})
  on conflict (identity) do update set role = excluded.role, scope = excluded.scope`
console.log(`${identity} es ${role}${scope ? ` (${scope})` : ''}`)
await sql.end()
