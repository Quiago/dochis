import { Button, Label, Link } from '@primer/react'
import { ShieldCheckIcon } from '@primer/octicons-react'
import ReportButton from './ReportButton'
import StatusLabel from './StatusLabel'
import Topics from './Topics'
import { freshness, REGISTRY, waLink, type PublicDoctor } from '@/lib/directory'

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

const MAX_INSURERS = 6

// Declared by the doctor (accent) vs published by the clinic (neutral, sourced): never mixed, so patients know which is which.
export function InsuranceLabels({ d, all = false }: { d: PublicDoctor; all?: boolean }) {
  const clinic = (d.clinic_insurers ?? []).filter((i) => !d.insurances.includes(i))
  const items = [...d.insurances.map((i) => ({ i, own: true })), ...clinic.map((i) => ({ i, own: false }))]
  if (!items.length && !d.clinic_reimbursement) return null
  const shown = all ? items : items.slice(0, MAX_INSURERS)
  return (
    <div className="insurers">
      <ShieldCheckIcon size={14} className="muted" aria-label="Seguros" />
      <ul className="topics">
        {d.clinic_reimbursement && (
          <li><Label variant="attention" title="La clínica no factura al seguro: pagas y luego reclamas a tu aseguradora">Pago y reembolso</Label></li>
        )}
        {shown.map(({ i, own }) => (
          <li key={i}><Label variant={own ? 'accent' : 'secondary'} title={own ? 'Declarado por el médico' : 'Según la web de la clínica'}>{i}</Label></li>
        ))}
        {items.length > shown.length && <li className="muted small">+{items.length - shown.length} más</li>}
      </ul>
      {(clinic.length > 0 || d.clinic_reimbursement) && d.clinic_insurance_source && (
        <Link href={d.clinic_insurance_source} target="_blank" rel="noopener nofollow" className="small muted-link">según su clínica</Link>
      )}
    </div>
  )
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
      <Topics items={d.languages} />
      <InsuranceLabels d={d} />
      <p className="muted small status">
        {f.text}
        {d.regulator && (
          <span> · Licencia {d.regulator} {d.license_number} · <Link href={REGISTRY[d.regulator]} target="_blank" rel="noopener">Comprobar</Link></span>
        )}
      </p>
      <div className="actions">
        {unclaimed ? (
          <Button as="a" href={`/entrar?medico=${d.slug}`} size="small">¿Eres tú? Reclama tu perfil</Button>
        ) : (
          <>
            {waLink(d) ? <WhatsAppButton d={d} /> : <span className="muted small">Contacto a través de su clínica</span>}
            <Link href={`/entrar?medico=${d.slug}`} className="small">¿Eres tú?</Link>
            <ReportButton slug={d.slug} name={d.full_name} />
          </>
        )}
      </div>
    </li>
  )
}
