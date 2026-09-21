// Phase 4: automatic freshness, community reports and the admin views that support the quarterly round.
import type postgres from 'postgres'
import type { Reviewer } from './onboarding'
import { roundStart } from './directory'
import { REPORT_REASONS } from './report-reasons'

export { roundStart }

const DAY = 86_400_000
const STALE_DAYS = 90
const HIDDEN_DAYS = 180
const REPORT_WINDOW_DAYS = 30
const REPORTS_TO_STALE = 2
const REPORTS_PER_DAY = 10

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * DAY)
const scopeOf = (r: Reviewer) => (r.role === 'admin' ? null : r.scope)


// Daily cron: >90 days without confirming → stale ("pendiente"), >180 → hidden.
export async function runFreshness(sql: postgres.Sql, now = new Date()) {
  const hidden = await sql`
    update doctors set status = 'hidden'
    where status in ('verified', 'stale') and last_confirmed_at < ${daysAgo(now, HIDDEN_DAYS)}`
  const stale = await sql`
    update doctors set status = 'stale'
    where status = 'verified' and last_confirmed_at < ${daysAgo(now, STALE_DAYS)}`
  return { stale: stale.count, hidden: hidden.count }
}

type ReportInput = { slug: string; reason: string; fingerprint: string; now?: Date }

// "Ya no está aquí": 2 different people within 30 days turn the profile stale until the doctor confirms.
export async function reportDoctor(sql: postgres.Sql, { slug, reason, fingerprint, now = new Date() }: ReportInput) {
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return 'invalid_reason' as const
  const [d] = await sql`select id from doctors where slug = ${slug} and status in ('verified', 'stale')`
  if (!d) return 'not_found' as const
  const [{ n }] = await sql`select count(*)::int as n from reports where reporter_fingerprint = ${fingerprint} and created_at > ${daysAgo(now, 1)}`
  if (n >= REPORTS_PER_DAY) return 'rate_limited' as const
  const inserted = await sql`
    insert into reports (doctor_id, reporter_fingerprint, reason, created_at) values (${d.id}, ${fingerprint}, ${reason}, ${now})
    on conflict (doctor_id, reporter_fingerprint) do nothing returning id`
  if (!inserted.length) return 'duplicate' as const
  await sql`
    update doctors set status = 'stale'
    where id = ${d.id} and status = 'verified'
      and (select count(distinct reporter_fingerprint) from reports
           where doctor_id = ${d.id} and created_at > ${daysAgo(now, REPORT_WINDOW_DAYS)}) >= ${REPORTS_TO_STALE}`
  return 'ok' as const
}

export async function listReports(sql: postgres.Sql, reviewer: Reviewer, now = new Date()) {
  const scope = scopeOf(reviewer)
  return sql<{ doctor_id: string; slug: string; full_name: string; specialty: string; status: string; count: number; reasons: string[]; last_at: Date }[]>`
    select d.id as doctor_id, d.slug, d.full_name, d.specialty, d.status,
           count(distinct r.reporter_fingerprint)::int as count, array_agg(distinct r.reason) as reasons, max(r.created_at) as last_at
    from reports r join doctors d on d.id = r.doctor_id
    where r.created_at > ${daysAgo(now, REPORT_WINDOW_DAYS)} and (${scope}::text is null or d.specialty = ${scope})
    group by d.id order by count desc, last_at desc`
}

// Admin decides the reports were wrong: delete them and, if still within 90 days, back to verified.
export async function dismissReports(sql: postgres.Sql, doctorId: string, reviewer: Reviewer, now = new Date()) {
  const scope = scopeOf(reviewer)
  await sql.begin(async (tx) => {
    const [d] = await tx`select specialty from doctors where id = ${doctorId}`
    if (!d || (scope && d.specialty !== scope)) throw new Error('Este perfil está fuera de tu ámbito')
    await tx`delete from reports where doctor_id = ${doctorId}`
    await tx`
      update doctors set status = 'verified'
      where id = ${doctorId} and status = 'stale' and last_confirmed_at >= ${daysAgo(now, STALE_DAYS)}`
  })
}

// Who has not confirmed since the round started, with private contacts for the broadcast lists (admins only).
export async function unconfirmedThisRound(sql: postgres.Sql, reviewer: Reviewer, now = new Date()) {
  const scope = scopeOf(reviewer)
  return sql<{ slug: string; full_name: string; specialty: string; phone_e164: string | null; email: string | null; last_confirmed_at: Date | null }[]>`
    select slug, full_name, specialty, phone_e164, email, last_confirmed_at from doctors
    where status in ('verified', 'stale') and (last_confirmed_at is null or last_confirmed_at < ${roundStart(now)})
      and (${scope}::text is null or specialty = ${scope})
    order by last_confirmed_at nulls first`
}
