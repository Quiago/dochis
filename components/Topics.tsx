import { Label } from '@primer/react'

// Topic-style labels (languages, insurances).
export default function Topics({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul className="topics">
      {items.map((t) => (
        <li key={t}><Label variant="accent">{t}</Label></li>
      ))}
    </ul>
  )
}
