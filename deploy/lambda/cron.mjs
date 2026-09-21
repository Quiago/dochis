// dochis-cron: runs daily (EventBridge Scheduler) and asks the app to update freshness.
// Outside the VPC on purpose: it only calls the public URL, so no NAT Gateway is needed.
export const handler = async () => {
  const res = await fetch(process.env.CRON_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const body = await res.text()
  console.log(res.status, body)
  if (!res.ok) throw new Error(`cron respondió ${res.status}`)
  return body
}
