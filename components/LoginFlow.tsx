'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { Button, Flash, FormControl, Heading, Link, SegmentedControl, Spinner, TextInput } from '@primer/react'
import { CheckCircleIcon } from '@primer/octicons-react'

type Channel = 'whatsapp' | 'email'
type Step =
  | { name: 'start'; error?: string }
  | { name: 'whatsapp'; phone: string; code: string; link: string }
  | { name: 'email'; email: string; error?: string }
  | { name: 'expired' }
  | { name: 'done' }

export default function LoginFlow({ next, intro, channels }: { next: string; intro: string; channels: Channel[] }) {
  const router = useRouter()
  const [channel, setChannel] = useState<Channel>(channels[0])
  const [step, setStep] = useState<Step>({ name: 'start' })
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState<string>()

  const finish = () => { setStep({ name: 'done' }); router.replace(next); router.refresh() }

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    const value = new FormData(e.currentTarget).get('identity')
    const body = channel === 'email' ? { email: value } : { phone: value }
    const res = await fetch('/api/auth/challenge', { method: 'POST', body: JSON.stringify(body) }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (!res?.ok) return setStep({ name: 'start', error: data?.error ?? 'No pudimos conectar. Inténtalo de nuevo.' })
    if (data.channel === 'email') return setStep({ name: 'email', email: data.email })
    setStep({ name: 'whatsapp', phone: data.phone, code: data.code, link: data.link })
    QRCode.toDataURL(data.link, { margin: 1, width: 184 }).then(setQr, () => setQr(undefined))
  }

  async function verifyEmailCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (step.name !== 'email') return
    setBusy(true)
    const code = String(new FormData(e.currentTarget).get('code') ?? '')
    const data = await fetch('/api/auth/verify', { method: 'POST', body: JSON.stringify({ code }) }).then((r) => r.json()).catch(() => null)
    setBusy(false)
    if (data?.status === 'verified') return finish()
    if (data?.status === 'expired') return setStep({ name: 'expired' })
    setStep({ ...step, error: 'El código no coincide. Revisa el correo e inténtalo de nuevo.' })
  }

  // WhatsApp: polls every 2 s while waiting for the message.
  useEffect(() => {
    if (step.name !== 'whatsapp') return
    const timer = setInterval(async () => {
      const data = await fetch('/api/auth/challenge', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)
      if (data?.status === 'verified') finish()
      else if (data?.status === 'expired') setStep({ name: 'expired' })
    }, 2000)
    return () => clearInterval(timer)
  }, [step.name])

  if (!channels.length) {
    return <Flash variant="warning">El acceso está en mantenimiento. Vuelve a intentarlo más tarde.</Flash>
  }

  if (step.name === 'done') {
    return (
      <div className="center" role="status">
        <CheckCircleIcon size={32} className="success-icon" />
        <Heading as="h2" className="auth-title">Listo</Heading>
        <p className="muted">Entrando…</p>
      </div>
    )
  }

  if (step.name === 'expired') {
    return (
      <div className="center">
        <Heading as="h2" className="auth-title">El código caducó</Heading>
        <p className="muted">Los códigos duran 10 minutos y se invalidan tras 5 intentos. Pide uno nuevo.</p>
        <Button variant="primary" block onClick={() => setStep({ name: 'start' })}>Pedir otro código</Button>
      </div>
    )
  }

  if (step.name === 'email') {
    return (
      <form onSubmit={verifyEmailCode}>
        <p className="muted small">Paso 2 de 2</p>
        <Heading as="h2" className="auth-title">Revisa tu correo</Heading>
        <p className="muted">Enviamos un código de 6 dígitos a <strong>{step.email}</strong>. Si no lo ves, mira en spam.</p>
        {step.error && <Flash variant="danger" className="auth-flash">{step.error}</Flash>}
        <FormControl required>
          <FormControl.Label>Código</FormControl.Label>
          <TextInput name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} block size="large" className="otp-input" autoFocus />
        </FormControl>
        <Button type="submit" variant="primary" block loading={busy} className="auth-submit">Entrar</Button>
        <p className="center small"><Link as="button" type="button" onClick={() => setStep({ name: 'start' })}>Usar otro correo</Link></p>
      </form>
    )
  }

  if (step.name === 'whatsapp') {
    return (
      <div>
        <p className="muted small">Paso 2 de 2</p>
        <Heading as="h2" className="auth-title">Envía este código por WhatsApp</Heading>
        <p className="muted">Toca el botón y envía el mensaje que aparece escrito. Así comprobamos que el número {step.phone} es tuyo.</p>
        <p className="otp-code" aria-label={`Código ${step.code.split('').join(' ')}`}>{step.code}</p>
        <div className="only-mobile">
          <Button as="a" href={step.link} target="_blank" rel="noopener" variant="primary" block>Abrir WhatsApp y enviar</Button>
        </div>
        <div className="only-desk center">
          <p className="muted small">Escanea con la cámara de tu móvil:</p>
          {qr && <img src={qr} width={184} height={184} alt="Código QR para abrir WhatsApp con el mensaje" className="qr" />}
          <p><Link href={step.link} target="_blank" rel="noopener">O ábrelo en WhatsApp Web</Link></p>
        </div>
        <p className="waiting muted" role="status"><Spinner size="small" /> Esperando tu mensaje…</p>
        <p className="center small"><Link as="button" onClick={() => setStep({ name: 'start' })}>Cambiar número</Link></p>
      </div>
    )
  }

  return (
    <form onSubmit={requestCode}>
      <p className="muted small">Paso 1 de 2</p>
      <p className="muted">{intro}</p>
      {channels.length > 1 && (
        <SegmentedControl aria-label="Cómo quieres entrar" fullWidth className="auth-switch" onChange={(i) => setChannel(channels[i])}>
          {channels.map((c) => (
            <SegmentedControl.Button key={c} selected={channel === c}>{c === 'whatsapp' ? 'WhatsApp' : 'Correo'}</SegmentedControl.Button>
          ))}
        </SegmentedControl>
      )}
      {step.error && <Flash variant="danger" className="auth-flash">{step.error}</Flash>}
      {channel === 'email' ? (
        <FormControl required key="email">
          <FormControl.Label>Tu correo</FormControl.Label>
          <TextInput name="identity" type="email" inputMode="email" autoComplete="email" block size="large" />
          <FormControl.Caption>Te enviamos un código de 6 dígitos. Sin contraseñas.</FormControl.Caption>
        </FormControl>
      ) : (
        <FormControl required key="phone">
          <FormControl.Label>Tu número de WhatsApp</FormControl.Label>
          <TextInput name="identity" type="tel" inputMode="tel" autoComplete="tel" defaultValue="+971 " block size="large" />
          <FormControl.Caption>Sin contraseñas ni correos. Solo tienes que enviar un mensaje.</FormControl.Caption>
        </FormControl>
      )}
      <Button type="submit" variant="primary" block loading={busy} className="auth-submit">Continuar</Button>
    </form>
  )
}
