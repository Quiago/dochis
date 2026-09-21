import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

// Relative Location: the app is served under more than one hostname (Cloudflare Pages and CloudFront).
export async function POST() {
  ;(await cookies()).delete(SESSION_COOKIE)
  return new NextResponse(null, { status: 303, headers: { Location: '/' } })
}
