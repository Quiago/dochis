import { Label } from '@primer/react'
import type { Freshness } from '@/lib/directory'

const VARIANT = { pending: 'attention', unclaimed: 'secondary' } as const

// Confirmed = verified badge next to the name (Instagram/Telegram style). Drawn inline so it follows the theme
// and needs no image license; the round line join softens the star into a scalloped seal.
function VerifiedBadge({ size }: { size: number }) {
  return (
    <svg className="verified-badge" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Confirmado">
      <title>Confirmado: confirmó sus datos este mes</title>
      <path
        d="M12 2L14.3 3.6L17 3.3L18.2 5.8L20.7 7L20.4 9.7L22 12L20.4 14.3L20.7 17L18.2 18.2L17 20.7L14.3 20.4L12 22L9.7 20.4L7 20.7L5.8 18.2L3.3 17L3.6 14.3L2 12L3.6 9.7L3.3 7L5.8 5.8L7 3.3L9.7 3.6Z"
        fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
      />
      <path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" stroke="var(--fgColor-onEmphasis)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function StatusLabel({ f, size = 20 }: { f: Freshness; size?: number }) {
  if (f.kind === 'confirmed') return <VerifiedBadge size={size} />
  return <Label variant={VARIANT[f.kind]}>{f.label}</Label>
}
