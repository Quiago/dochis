// Applies db/migrations/*.sql in order (once each) and sets app role passwords from their URLs.
// Usage: node scripts/migrate.ts [--seed]   (reads DATABASE_ADMIN_URL, DATABASE_READER_URL, DATABASE_URL)
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

const DIR = join(import.meta.dirname, '..', 'db')

type Options = { adminUrl: string; readerUrl?: string; writerUrl?: string; seed?: boolean }

// Returns the names of the migrations applied in this run.
export async function migrate({ adminUrl, readerUrl, writerUrl, seed }: Options): Promise<string[]> {
  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} })
  try {
    await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`
    const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name as string))
    const pending = readdirSync(join(DIR, 'migrations')).filter((f) => f.endsWith('.sql') && !done.has(f)).sort()
    for (const name of pending) {
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(join(DIR, 'migrations', name), 'utf8'))
        await tx`insert into schema_migrations (name) values (${name})`
      })
    }
    for (const [role, url] of [['web_reader', readerUrl], ['app_writer', writerUrl]] as const) {
      if (!url) continue
      const u = new URL(url)
      if (u.username !== role) throw new Error(`La URL de ${role} debe usar el usuario ${role} (tiene ${u.username})`)
      if (!u.password) throw new Error(`La URL de ${role} no tiene contraseña`)
      await sql.unsafe(`alter role ${role} password '${decodeURIComponent(u.password).replaceAll("'", "''")}'`)
    }
    if (seed && pending.length) await sql.unsafe(readFileSync(join(DIR, 'seed.sql'), 'utf8'))
    return pending
  } finally {
    await sql.end()
  }
}

if (import.meta.main) {
  const adminUrl = process.env.DATABASE_ADMIN_URL
  if (!adminUrl) throw new Error('Falta DATABASE_ADMIN_URL')
  const applied = await migrate({
    adminUrl,
    readerUrl: process.env.DATABASE_READER_URL,
    writerUrl: process.env.DATABASE_URL,
    seed: process.argv.includes('--seed'),
  })
  console.log(applied.length ? `Aplicadas: ${applied.join(', ')}` : 'Sin migraciones pendientes')
}
