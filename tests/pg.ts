// Fresh throwaway database per test file (files run in parallel). Roles are cluster-wide, so the
// passwords match .env.example to keep the dev database working.
import postgres from 'postgres'
import { migrate } from '@/scripts/migrate'

const HOST = process.env.TEST_PG_HOST ?? 'localhost:5433'
const url = (user: string, pass: string, db: string) => `postgres://${user}:${pass}@${HOST}/${db}`

export async function freshDatabase(name: string, { seed = true } = {}) {
  const admin = postgres(url('postgres', 'postgres', 'postgres'), { max: 1, connect_timeout: 2, onnotice: () => {} })
  const urls = {
    adminUrl: url('postgres', 'postgres', name),
    readerUrl: url('web_reader', 'reader_local', name),
    writerUrl: url('app_writer', 'writer_local', name),
  }
  try {
    // Files run in parallel but roles are cluster-wide: serialize setup ("tuple concurrently updated").
    await admin`select pg_advisory_lock(20260921)`
    await admin`drop database if exists ${admin(name)} with (force)`
    await admin`create database ${admin(name)}`
    await migrate({ ...urls, seed })
    return urls
  } catch (e) {
    if ((e as { code?: string }).code === 'ECONNREFUSED') return null
    throw e
  } finally {
    await admin.end()
  }
}
