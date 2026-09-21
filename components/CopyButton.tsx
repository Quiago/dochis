'use client'
import { useState } from 'react'
import { Button } from '@primer/react'
import { CheckIcon, CopyIcon } from '@primer/octicons-react'

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button size="small" disabled={!text} leadingVisual={done ? <CheckIcon /> : <CopyIcon />}
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000) })}>
      {done ? 'Copiado' : label}
    </Button>
  )
}
