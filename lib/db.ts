import 'server-only'
import postgres from 'postgres'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`)
  return value
}

// Pools survive dev hot reloads on globalThis. RDS: add ?sslmode=require to the URLs.
const g = globalThis as { dbReader?: postgres.Sql; dbWriter?: postgres.Sql }

// web_reader role: can only SELECT the public views.
export const reader = () => (g.dbReader ??= postgres(requireEnv('DATABASE_READER_URL'), { max: 5 }))

// app_writer role: data writes from server routes; never owns the schema.
export const writer = () => (g.dbWriter ??= postgres(requireEnv('DATABASE_URL'), { max: 5 }))
