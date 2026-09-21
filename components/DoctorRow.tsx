import { Button, Link } from '@primer/react'
import { VerifiedIcon } from '@primer/octicons-react'
import StatusLabel from './StatusLabel'
import Topics from './Topics'
import { freshness, waLink, type PublicDoctor } from '@/lib/directory'

export function WhatsAppButton({ d, block }: { d: PublicDoctor; block?: boolean }) {
  const href = waLink(d)
  if (!href) return null
  return (
    <Button as="a" href={href} target="_blank" rel="noopener" variant="primary" size="small" block={block}>
      Escribir por WhatsApp
    </Button>
  )
}

export function Where({ d }: { d: PublicDoctor }) {
  return <>{d.clinic}{d.area ? `, ${d.area}` : ''} ({d.emirate})</>
}

// Repository-list style row.
export default function DoctorRow({ d, now }: { d: PublicDoctor; now: Date }) {
  const f = freshness(d, now)
  const unclaimed = f.kind === 'unclaimed'
  return (
    <li className="row">
      <div className="row-head">
        <Link href={`/medico/${d.slug}`} className="row-name">{d.full_name}</Link>
        <StatusLabel f={f} />
      </div>
      <p className="row-spec">{d.specialty}</p>
      <p className="muted"><Where d={d} /></p>
      <Topics items={[...d.languages, ...d.insurances]} />
      <p className="muted small status">
        {f.text}
        {d.regulator && (
          <span className="license"> · <VerifiedIcon size={14} /> Licencia {d.regulator}</span>
        )}
      </p>
      <div className="actions">
        {unclaimed ? (
          <Button as="a" href={`/entrar?medico=${d.slug}`} size="small">¿Eres tú? Reclama tu perfil</Button>
        ) : (
          <>
            {waLink(d) ? <WhatsAppButton d={d} /> : <span className="muted small">Contacto a través de su clínica</span>}
            <Link href={`/entrar?medico=${d.slug}`} className="small">¿Eres tú?</Link>
          </>
        )}
      </div>
    </li>
  )
}
