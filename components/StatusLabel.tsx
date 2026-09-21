import { Label } from '@primer/react'
import type { Freshness } from '@/lib/directory'

const VARIANT = { confirmed: 'success', pending: 'attention', unclaimed: 'secondary' } as const

export default function StatusLabel({ f }: { f: Freshness }) {
  return <Label variant={VARIANT[f.kind]}>{f.label}</Label>
}
