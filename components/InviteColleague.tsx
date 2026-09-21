'use client'
import { useEffect, useState } from 'react'
import { Button } from '@primer/react'
import { CheckIcon, CopyIcon, ShareAndroidIcon } from '@primer/octicons-react'

const MESSAGE = 'Estoy en el directorio gratuito de médicos que atienden en español en los Emiratos. Crear tu perfil lleva 2 minutos:'

// Native share sheet on phones (WhatsApp, mail…); WhatsApp link + copy on desktop. No emails sent by us.
export default function InviteColleague({ url }: { url: string }) {
  const [canShare, setCanShare] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => setCanShare(typeof navigator !== 'undefined' && !!navigator.share), [])
  if (canShare) {
    return (
      <Button block leadingVisual={ShareAndroidIcon} onClick={() => navigator.share({ title: 'Médicos en español · Emiratos', text: MESSAGE, url }).catch(() => {})}>
        Invitar a un colega
      </Button>
    )
  }
  return (
    <div className="invite">
      <Button as="a" href={`https://wa.me/?text=${encodeURIComponent(`${MESSAGE} ${url}`)}`} target="_blank" rel="noopener">Enviar por WhatsApp</Button>
      <Button leadingVisual={copied ? CheckIcon : CopyIcon} onClick={() => navigator.clipboard.writeText(`${MESSAGE} ${url}`).then(() => setCopied(true))}>
        {copied ? 'Copiado' : 'Copiar enlace'}
      </Button>
    </div>
  )
}
