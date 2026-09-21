import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

export async function POST(req: Request) {
  ;(await cookies()).delete(SESSION_COOKIE)
  return NextResponse.redirect(new URL('/', req.url), 303)
}
