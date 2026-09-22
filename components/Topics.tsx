import { Label } from '@primer/react'
import { CATEGORY, type Category } from '@/lib/categories'

// Topic-style labels, coloured by kind (same colour as the matching filter).
export default function Topics({ items, kind }: { items: string[]; kind: Category }) {
  if (!items.length) return null
  return (
    <ul className="topics">
      {items.map((t) => (
        <li key={t}><Label variant={CATEGORY[kind].variant}>{t}</Label></li>
      ))}
    </ul>
  )
}
