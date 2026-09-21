import { timingSafeEqual } from 'node:crypto'
import { writer } from '@/lib/db'
import { runFreshness } from '@/lib/freshness'

const authorized = (header: string | null) => {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ''}`)
  const given = Buffer.from(header ?? '')
  return !!process.env.CRON_SECRET && given.length === expected.length && timingSafeEqual(given, expected)
}

// Called daily by the dochis-cron Lambda (EventBridge Scheduler).
export async function POST(req: Request) {
  if (!authorized(req.headers.get('authorization'))) return new Response('Unauthorized', { status: 401 })
  const result = await runFreshness(writer())
  console.log('freshness', result)
  return Response.json(result)
}
