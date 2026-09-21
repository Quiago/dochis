// Two login channels sharing login_challenges:
// - WhatsApp (reverse OTP): the web shows a code, the doctor sends it to the bot, the webhook verifies sender + code.
// - Email: the code is emailed and typed back on the web (verifyTypedCode).
// Every function takes the sql client so tests can run against a throwaway database.
import { isIP } from 'node:net'
import type postgres from 'postgres'
import { codesMatch, generateCode, hashCode } from './otp'

const TTL_MS = 10 * 60_000
const HOUR_MS = 60 * 60_000
const MAX_ATTEMPTS = 5
const PER_IDENTITY_PER_HOUR = 5
const PER_IP_PER_HOUR = 20

// Exactly one of phone / email (also enforced by the challenge_identity CHECK).
type CreateInput = { phone?: string; email?: string; ip: string | null; pepper: string; dailyCap: number; now?: Date }
export type CreateResult = { id: string; code: string } | { error: 'rate_limited_identity' | 'rate_limited_ip' | 'daily_cap' }

// ponytail: counts then inserts without a lock; concurrent requests can overshoot a limit by a few.
export async function createChallenge(sql: postgres.Sql, input: CreateInput): Promise<CreateResult> {
  const { ip, pepper, dailyCap, now = new Date() } = input
  const phone = input.phone ?? null
  const email = input.email ?? null
  if (!phone === !email) throw new Error('createChallenge: indica teléfono o correo, no ambos')
  const safeIp = ip && isIP(ip) ? ip : null
  const hourAgo = new Date(now.getTime() - HOUR_MS)
  const dayAgo = new Date(now.getTime() - 24 * HOUR_MS)
  const [c] = await sql`
    select count(*) filter (where (phone_e164 = ${phone} or email = ${email}) and created_at > ${hourAgo}) as identity,
           count(*) filter (where ip = ${safeIp}::inet and created_at > ${hourAgo}) as ip,
           count(*) as day
    from login_challenges where created_at > ${dayAgo}`
  if (Number(c.identity) >= PER_IDENTITY_PER_HOUR) return { error: 'rate_limited_identity' }
  if (safeIp && Number(c.ip) >= PER_IP_PER_HOUR) return { error: 'rate_limited_ip' }
  if (Number(c.day) >= dailyCap) return { error: 'daily_cap' }

  const code = generateCode()
  await sql`update login_challenges set status = 'expired' where (phone_e164 = ${phone} or email = ${email}) and status = 'pending'`
  const [row] = await sql`
    insert into login_challenges (phone_e164, email, code_hash, expires_at, ip, created_at)
    values (${phone}, ${email}, ${hashCode(code, pepper)}, ${new Date(now.getTime() + TTL_MS)}, ${safeIp}::inet, ${now})
    returning id`
  return { id: row.id as string, code }
}

// Marks the challenge verified on a match; otherwise counts the attempt and expires it at MAX_ATTEMPTS.
async function checkCode(sql: postgres.Sql, id: string, hash: string, code: string, pepper: string, now: Date) {
  if (codesMatch(code, hash, pepper)) {
    await sql`update login_challenges set status = 'verified', verified_at = ${now} where id = ${id} and status = 'pending'`
    return 'verified' as const
  }
  await sql`
    update login_challenges
    set attempts = attempts + 1,
        status = case when attempts + 1 >= ${MAX_ATTEMPTS} then 'expired'::challenge_status else status end
    where id = ${id}`
  return 'wrong_code' as const
}

type VerifyInput = { from: string; code: string; pepper: string; now?: Date }

// Called by the webhook: WhatsApp guarantees `from`, so only the phone's owner can verify.
export async function verifyFromWhatsApp(sql: postgres.Sql, { from, code, pepper, now = new Date() }: VerifyInput) {
  const [ch] = await sql`
    select id, code_hash from login_challenges
    where phone_e164 = ${from} and status = 'pending' and expires_at > ${now}
    order by created_at desc limit 1`
  if (!ch) return 'no_challenge' as const
  return checkCode(sql, ch.id, ch.code_hash, code, pepper, now)
}

type TypedInput = { id: string; code: string; pepper: string; now?: Date }

// Email channel: the code the user typed on the web. Phone challenges can only be verified by WhatsApp.
export async function verifyTypedCode(sql: postgres.Sql, { id, code, pepper, now = new Date() }: TypedInput) {
  if (!UUID.test(id)) return 'expired' as const
  const [ch] = await sql`
    select id, code_hash from login_challenges
    where id = ${id} and email is not null and status = 'pending' and expires_at > ${now}`
  if (!ch) return 'expired' as const
  return checkCode(sql, id, ch.code_hash, code, pepper, now)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function challengeStatus(sql: postgres.Sql, id: string, now = new Date()) {
  if (!UUID.test(id)) return 'expired' as const
  const [ch] = await sql`select status, expires_at from login_challenges where id = ${id}`
  if (!ch) return 'expired' as const
  if (ch.status === 'pending' && ch.expires_at <= now) return 'expired' as const
  return ch.status as 'pending' | 'verified' | 'expired'
}

// Hands out the session exactly once: returns the phone or email, or null if not verified or already consumed.
export async function consumeChallenge(sql: postgres.Sql, id: string): Promise<string | null> {
  if (!UUID.test(id)) return null
  const [row] = await sql`
    update login_challenges set consumed_at = now()
    where id = ${id} and status = 'verified' and consumed_at is null
    returning coalesce(phone_e164, email) as identity`
  return (row?.identity as string) ?? null
}
