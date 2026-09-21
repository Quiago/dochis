import { beforeEach, describe, expect, it, vi } from 'vitest'

const run = vi.fn()
const report = vi.fn()
vi.mock('@/lib/db', () => ({ writer: () => 'sql' }))
vi.mock('@/lib/freshness', () => ({ runFreshness: (...a: unknown[]) => run(...a), reportDoctor: (...a: unknown[]) => report(...a) }))

const cron = await import('@/app/api/cron/freshness/route')
const reports = await import('@/app/api/reports/route')
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'POST', body: JSON.stringify(body), headers })

beforeEach(() => { vi.stubEnv('CRON_SECRET', 'cron-secret'); vi.stubEnv('OTP_PEPPER', 'p'); run.mockReset(); report.mockReset() })

describe('cron de frescura', () => {
  it('rechaza sin el secreto o con uno incorrecto', async () => {
    expect((await cron.POST(post('https://x/api/cron/freshness', {}))).status).toBe(401)
    expect((await cron.POST(post('https://x/api/cron/freshness', {}, { authorization: 'Bearer otro' }))).status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it('rechaza si CRON_SECRET no está configurado', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await cron.POST(post('https://x/api/cron/freshness', {}, { authorization: 'Bearer ' }))).status).toBe(401)
  })

  it('ejecuta con el secreto correcto', async () => {
    run.mockResolvedValue({ stale: 3, hidden: 1 })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await cron.POST(post('https://x/api/cron/freshness', {}, { authorization: 'Bearer cron-secret' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ stale: 3, hidden: 1 })
  })
})

describe('reportes', () => {
  it('la huella no contiene la IP y es estable para la misma persona', async () => {
    report.mockResolvedValue('ok')
    const h = { 'cloudfront-viewer-address': '203.0.113.7:1234', 'user-agent': 'UA' }
    await reports.POST(post('https://x/api/reports', { slug: 'a', reason: 'Otro' }, h))
    await reports.POST(post('https://x/api/reports', { slug: 'b', reason: 'Otro' }, h))
    const [fp1, fp2] = report.mock.calls.map((c) => c[1].fingerprint)
    expect(fp1).toBe(fp2)
    expect(fp1).toMatch(/^[0-9a-f]{64}$/)
    expect(fp1).not.toContain('203.0.113.7')
  })

  it('traduce los resultados a mensajes y códigos HTTP', async () => {
    report.mockResolvedValueOnce('rate_limited')
    const r = await reports.POST(post('https://x/api/reports', { slug: 'a', reason: 'Otro' }))
    expect(r.status).toBe(429)
    expect((await r.json()).error).toMatch(/muchos reportes/)
    expect((await reports.POST(post('https://x/api/reports', { slug: 1 }))).status).toBe(400)
  })
})
