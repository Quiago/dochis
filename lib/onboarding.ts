// Sign-up, self-edit and review of flagged profiles. Every function takes the sql client (tests use a throwaway DB).
// Identity = the login phone (E.164) or email of the session.
import type postgres from 'postgres'
import { normalize, slugify } from './directory.ts'
import type { ProfileData } from './profile'
import type { Review } from './review.ts'

export type Reviewer = { identity: string; role: 'admin' | 'ambassador'; scope: string | null }
type Sql = postgres.Sql | postgres.TransactionSql

// ProfileData ya trae public_email/links/hours_*, pero la tarea 9 todavía no ha añadido esas columnas a `doctors`.
// Se excluyen de los inserts/updates hasta entonces para no romper la escritura en base de datos.
function dbFields(data: ProfileData) {
  const { public_email, links, hours_weekday_open, hours_weekday_close, hours_weekend_open, hours_weekend_close, ...rest } = data
  return rest
}

const isEmail = (identity: string) => identity.includes('@')
const norm = (identity: string) => (isEmail(identity) ? identity.toLowerCase() : identity)

export async function findDoctorByIdentity(sql: Sql, identity: string) {
  const id = norm(identity)
  const [row] = isEmail(id)
    ? await sql`select * from doctors where lower(email) = ${id}`
    : await sql`select * from doctors where phone_e164 = ${id}`
  return row ?? null
}

export async function pendingRequestFor(sql: Sql, identity: string) {
  const [row] = await sql`
    select r.*, d.full_name as doctor_name from verification_requests r join doctors d on d.id = r.doctor_id
    where r.identity = ${norm(identity)} and r.status = 'pending' order by r.created_at desc limit 1`
  return row ?? null
}

export async function uniqueSlug(sql: Sql, name: string) {
  const base = slugify(name) || 'medico'
  const taken = new Set((await sql`select slug from doctors where slug = ${base} or slug like ${base + '-%'}`).map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
}

// Imported profile with the same name as a newly published one: it is the same person, hide the old card.
async function hideUnclaimedDuplicates(tx: postgres.TransactionSql, keepId: string, fullName: string) {
  const key = normalize(fullName).replace(/\s+/g, ' ').trim()
  const candidates = await tx`select id, full_name from doctors where status = 'unclaimed' and id <> ${keepId}`
  const ids = candidates.filter((d) => normalize(d.full_name).replace(/\s+/g, ' ').trim() === key).map((d) => d.id)
  if (ids.length) await tx`update doctors set status = 'hidden' where id in ${tx(ids)}`
}

async function flag(tx: postgres.TransactionSql, doctorId: string, identity: string, kind: 'signup' | 'license', data: ProfileData, issues: string[]) {
  const payload = tx.json({ issues } as postgres.JSONValue)
  const updated = await tx`
    update verification_requests set payload = ${payload}, license_number = ${data.license_number}, regulator = ${data.regulator}
    where doctor_id = ${doctorId} and status = 'pending' returning id`
  if (!updated.length) {
    await tx`insert into verification_requests (doctor_id, kind, identity, license_number, regulator, payload)
             values (${doctorId}, ${kind}, ${identity}, ${data.license_number}, ${data.regulator}, ${payload})`
  }
}

// New doctor: published at once when the automatic review is clean; otherwise waits in "Marcados para revisar".
export async function signUp(sql: postgres.Sql, identity: string, data: ProfileData, review: Review, now = new Date()) {
  const id = norm(identity)
  return sql.begin(async (tx) => {
    const slug = await uniqueSlug(tx, data.full_name)
    const [d] = await tx`
      insert into doctors ${tx({
        ...dbFields(data), slug, status: review.ok ? 'verified' : 'pending_verification', consent_at: now,
        last_confirmed_at: review.ok ? now : null, phone_e164: isEmail(id) ? null : id, email: isEmail(id) ? id : null,
      })}
      returning id, slug`
    if (review.ok) {
      await tx`insert into confirmations (doctor_id, confirmed_at) values (${d.id}, ${now})`
      await hideUnclaimedDuplicates(tx, d.id, data.full_name)
    } else {
      await flag(tx, d.id, id, 'signup', data, review.issues)
    }
    return { id: d.id as string, slug: d.slug as string, published: review.ok }
  })
}

// Owner edits their profile (including an imported one matched by phone/email). A clean review publishes and counts
// as this month's confirmation. A flagged review never unpublishes a live doctor over a false positive: it only
// blocks when the profile was not public yet or the licence changed.
export async function saveOwnProfile(sql: postgres.Sql, identity: string, data: ProfileData, review: Review, now = new Date()): Promise<'saved' | 'pending'> {
  const id = norm(identity)
  return sql.begin(async (tx) => {
    const d = await findDoctorByIdentity(tx, id)
    if (!d) throw new Error('No hay un perfil asociado a esta cuenta')
    const live = d.status === 'verified' || d.status === 'stale'
    // Solo el número o la autoridad obligan a revisar de nuevo. Ocultar la licencia (show_license) no es un cambio de licencia.
    const licenseChanged = d.license_number !== data.license_number || d.regulator !== data.regulator
    const fields = { ...dbFields(data), consent_at: d.consent_at ?? now }

    if (review.ok || (live && !licenseChanged)) {
      await tx`update doctors set ${tx({ ...fields, status: 'verified', last_confirmed_at: now })} where id = ${d.id}`
      await tx`insert into confirmations (doctor_id, confirmed_at) values (${d.id}, ${now})`
      if (review.ok) await tx`update verification_requests set status = 'approved', reviewed_by = 'revisión automática', reviewed_at = ${now} where doctor_id = ${d.id} and status = 'pending'`
      else await flag(tx, d.id, id, 'license', data, review.issues)
      return 'saved'
    }
    await tx`update doctors set ${tx({ ...fields, status: 'pending_verification' })} where id = ${d.id}`
    await flag(tx, d.id, id, live ? 'license' : 'signup', data, review.issues)
    return 'pending'
  })
}

export async function getReviewer(sql: Sql, identity: string): Promise<Reviewer | null> {
  const [row] = await sql`select identity, role, scope from admins where identity = ${norm(identity)}`
  return (row as Reviewer | undefined) ?? null
}

const scopeOf = (r: Reviewer) => (r.role === 'admin' ? null : r.scope)

export async function listPendingRequests(sql: Sql, reviewer: Reviewer) {
  const scope = scopeOf(reviewer)
  return sql`
    select r.id, r.kind, r.identity, r.license_number, r.regulator, r.payload, r.created_at, r.doctor_id,
           coalesce(r.payload->>'full_name', d.full_name) as doctor_name, d.slug as doctor_slug,
           coalesce(r.payload->>'specialty', d.specialty) as doctor_specialty, d.status as doctor_status
    from verification_requests r join doctors d on d.id = r.doctor_id
    where r.status = 'pending' and (${scope}::text is null or coalesce(r.payload->>'specialty', d.specialty) = ${scope})
    order by r.created_at`
}

async function lockRequest(tx: postgres.TransactionSql, id: string, reviewer: Reviewer) {
  const [req] = await tx`
    select r.*, coalesce(r.payload->>'specialty', d.specialty) as specialty
    from verification_requests r join doctors d on d.id = r.doctor_id
    where r.id = ${id} and r.status = 'pending' for update of r`
  if (!req) throw new Error('La solicitud ya no está pendiente')
  const scope = scopeOf(reviewer)
  if (scope && req.specialty !== scope) throw new Error('Esta solicitud está fuera de tu ámbito')
  return req
}

export async function approveRequest(sql: postgres.Sql, id: string, reviewer: Reviewer, now = new Date()) {
  await sql.begin(async (tx) => {
    const req = await lockRequest(tx, id, reviewer)
    await tx`update doctors set status = 'verified', last_confirmed_at = ${now} where id = ${req.doctor_id}`
    await tx`insert into confirmations (doctor_id, confirmed_at) values (${req.doctor_id}, ${now})`
    await tx`update verification_requests set status = 'approved', reviewed_by = ${reviewer.identity}, reviewed_at = ${now} where id = ${id}`
  })
}

export async function rejectRequest(sql: postgres.Sql, id: string, reviewer: Reviewer, now = new Date()) {
  await sql.begin(async (tx) => {
    const req = await lockRequest(tx, id, reviewer)
    await tx`update verification_requests set status = 'rejected', reviewed_by = ${reviewer.identity}, reviewed_at = ${now} where id = ${id}`
    // A rejected flagged profile is hidden.
    await tx`update doctors set status = 'hidden' where id = ${req.doctor_id}`
  })
}
