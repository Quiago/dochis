'use client'
import { TextInput } from '@primer/react'
import { SearchIcon } from '@primer/octicons-react'

// Plain GET form (works without JS). Client-side so the icon element never crosses the server→client boundary.
export default function SearchForm({ q, hidden }: { q?: string; hidden: [string, string][] }) {
  return (
    <form method="get" action="/" role="search">
      {hidden.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <TextInput name="q" type="search" block size="large" defaultValue={q}
        placeholder="Nombre, especialidad o clínica" aria-label="Buscar profesional" leadingVisual={SearchIcon} />
    </form>
  )
}
