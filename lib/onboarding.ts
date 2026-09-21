// Sign-up, claim, self-edit and ambassador review. Every function takes the sql client (tests use a throwaway DB).
// Identity = the login phone (E.164) or email of the session.
import type postgres from 'postgres'
import { slugify } from './directory'
import type { ProfileData } from './profile'

export type Reviewer = { identity: string; role: 'admin' | 'ambassador'; scope: string | null }
type Sql = postgres.Sql | postgres.TransactionSql

const isEmail = (identity: string) => identity.includes('@')
const norm = (identity: string) => (isEmail(identity) ? identity.toLowerCase() : identity)
const PROFILE_COLUMNS = ['full_name', 'specialty', 'clinic', 'area', 'emirate', 'languages', 'insurances', 'regulator', 'license_number', 'public_whatsapp'] as const

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

async function uniqueSlug(sql: Sql, name: string) {
  const base = slugify(name) || 'medico'
  const taken = new Set((await sql`select slug from doctors where slug = ${base} or slug like ${base + '-%'}`).map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
}

// New doctor: private until an ambassador verifies the license.
export async function signUp(sql: postgres.Sql, identity: string, data: ProfileData) {
  const id = norm(identity)
  return sql.begin(async (tx) => {
    const slug = await uniqueSlug(tx, data.full_name)
    const [d] = await tx`
      insert into doctors ${tx({ ...data, slug, status: 'pending_verification', consent_at: new Date(), phone_e164: isEmail(id) ? null : id, email: isEmail(id) ? id : null })}
      returning id, slug`
    await tx`insert into verification_requests ${tx({ doctor_id: d.id, kind: 'signup', identity: id, license_number: data.license_number, regulator: data.regulator })}`
    return { id: d.id as string, slug: d.slug as string }
  })
}

// Owner edits their own profile. Same license on a live profile = saved and counted as a confirmation;
// a new license (or a profile not yet verified) goes to review.
export async function saveOwnProfile(sql: postgres.Sql, identity: string, data: ProfileData, now = new Date()): Promise<'saved' | 'pending'> {
  const id = norm(identity)
  return sql.begin(async (tx) => {
    const d = await findDoctorByIdentity(tx, id)
    if (!d) throw new Error('No hay un perfil asociado a esta cuenta')
    const live = d.status === 'verified' || d.status === 'stale'
    const licenseChanged = d.license_number !== data.license_number || d.regulator !== data.regulator
    const fields = { ...data, consent_at: d.consent_at ?? now }

    if (live && !licenseChanged) {
      await tx`update doctors set ${tx({ ...fields, status: 'verified', last_confirmed_at: now })} where id = ${d.id}`
      await tx`insert into confirmations (doctor_id, confirmed_at) values (${d.id}, ${now})`
      return 'saved'
    }

    // An imported (unclaimed) profile keeps showing its minimal public card until approved.
    const status = d.status === 'unclaimed' ? 'unclaimed' : 'pending_verification'
    const kind = d.status === 'unclaimed' ? 'claim' : live ? 'license' : 'signup'
    await tx`update doctors set ${tx({ ...fields, status })} where id = ${d.id}`
    const updated = await tx`
      update verification_requests set license_number = ${data.license_number}, regulator = ${data.regulator}
      where doctor_id = ${d.id} and identity = ${id} and status = 'pending' returning id`
    if (!updated.length) {
      await tx`insert into verification_requests ${tx({ doctor_id: d.id, kind, identity: id, license_number: data.license_number, regulator: data.regulator })}`
    }
    return 'pending'
  })
}

// "¿Eres tú?" on a profile not linked to this identity: nothing changes until approved.
export async function submitClaim(sql: postgres.Sql, identity: string, doctorId: string, data: ProfileData) {
  const id = norm(identity)
  const payload = sql.json(data as unknown as postgres.JSONValue)
  const updated = await sql`
    update verification_requests set payload = ${payload}, license_number = ${data.license_number}, regulator = ${data.regulator}
    where doctor_id = ${doctorId} and identity = ${id} and kind = 'claim' and status = 'pending' returning id`
  if (updated.length) return
  await sql`
    insert into verification_requests (doctor_id, kind, identity, license_number, regulator, payload)
    values (${doctorId}, 'claim', ${id}, ${data.license_number}, ${data.regulator}, ${payload})`
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
    if (req.kind === 'claim' && Object.keys(req.payload).length) {
      const fields = Object.fromEntries(PROFILE_COLUMNS.map((c) => [c, req.payload[c] ?? null]))
      const link = isEmail(req.identity) ? { email: req.identity } : { phone_e164: req.identity }
      await tx`update doctors set ${tx({ ...fields, ...link, consent_at: now })} where id = ${req.doctor_id}`
    }
    await tx`update doctors set status = 'verified', last_confirmed_at = ${now} where id = ${req.doctor_id}`
    await tx`insert into confirmations (doctor_id, confirmed_at) values (${req.doctor_id}, ${now})`
    await tx`update verification_requests set status = 'approved', reviewed_by = ${reviewer.identity}, reviewed_at = ${now} where id = ${id}`
    // Competing claims for the same profile lose.
    await tx`
      update verification_requests set status = 'rejected', reviewed_by = ${reviewer.identity}, reviewed_at = ${now}
      where doctor_id = ${req.doctor_id} and status = 'pending' and kind = 'claim'`
  })
}

export async function rejectRequest(sql: postgres.Sql, id: string, reviewer: Reviewer, now = new Date()) {
  await sql.begin(async (tx) => {
    const req = await lockRequest(tx, id, reviewer)
    await tx`update verification_requests set status = 'rejected', reviewed_by = ${reviewer.identity}, reviewed_at = ${now} where id = ${id}`
    // A rejected sign-up or license change hides the profile; a rejected claim changes nothing.
    if (req.kind !== 'claim') await tx`update doctors set status = 'hidden' where id = ${req.doctor_id}`
  })
}
