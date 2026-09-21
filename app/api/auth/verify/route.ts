import { NextResponse } from 'next/server'
import { consumeChallenge, verifyTypedCode } from '@/lib/auth'
import { writer } from '@/lib/db'
import { clearChallengeCookie, getChallengeCookie } from '@/lib/login-cookie'
import { startSession } from '@/lib/session'

// Email channel: the 6-digit code typed on the web.
export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}))
  const id = await getChallengeCookie()
  if (!id || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    return NextResponse.json({ status: id ? 'wrong_code' : 'expired' })
  }
  const status = await verifyTypedCode(writer(), { id, code: code.trim(), pepper: process.env.OTP_PEPPER! })
  if (status !== 'verified') return NextResponse.json({ status })
  const identity = await consumeChallenge(writer(), id)
  await clearChallengeCookie()
  if (!identity) return NextResponse.json({ status: 'expired' })
  await startSession(identity)
  return NextResponse.json({ status: 'verified' })
}
