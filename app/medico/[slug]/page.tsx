import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Button, Heading, Link } from '@primer/react'
import { ArrowLeftIcon, ClockIcon, LinkIcon, LocationIcon, MailIcon, OrganizationIcon } from '@primer/octicons-react'
import Avatar from '@/components/Avatar'
import ReportButton from '@/components/ReportButton'
import StatusLabel from '@/components/StatusLabel'
import Topics from '@/components/Topics'
import { InsuranceLabels, WhatsAppButton, Where } from '@/components/DoctorRow'
import { getDoctorBySlug } from '@/lib/doctors'
import { confirmationMonths, formatHours, freshness, REGISTRY } from '@/lib/directory'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await getDoctorBySlug((await params).slug)
  if (!found) return { title: 'Perfil no encontrado' }
  const d = found.doctor
  return {
    title: `${d.full_name} · ${d.specialty}`,
    description: `${d.full_name}, ${d.specialty} en ${d.clinic} (${d.emirate}). Atiende en español.`,
    alternates: { canonical: `/medico/${d.slug}` },
  }
}

const MONTH = new Intl.DateTimeFormat('es', { month: 'short', timeZone: 'UTC' })

export default async function DoctorPage({ params }: Props) {
  const found = await getDoctorBySlug((await params).slug)
  if (!found) notFound()
  const { doctor: d, confirmations } = found
  const now = new Date()
  const f = freshness(d, now)
  const months = confirmationMonths(confirmations, now)
  const confirmedCount = months.filter((m) => m.confirmed).length

  return (
    <main className="container">
      <p><Link href="/" className="small"><ArrowLeftIcon /> Volver al directorio</Link></p>
      <div className="profile">
        <aside className="profile-side">
          <Avatar d={d} size="large" />
          <Heading as="h1" className="profile-name">{d.full_name} {f.kind === 'confirmed' && <StatusLabel f={f} size={24} />}</Heading>
          <p className="row-spec">{d.specialty}</p>
          <ul className="facts muted">
            <li><OrganizationIcon /> {d.clinic}</li>
            <li><LocationIcon /> {d.area ? `${d.area}, ` : ''}{d.emirate}</li>
          </ul>
          <Topics items={d.languages} kind="idioma" />
          <div className="profile-actions">
            {f.kind === 'unclaimed' ? (
              <Button as="a" href={`/entrar?medico=${d.slug}`} block>¿Eres tú? Reclama tu perfil</Button>
            ) : d.public_whatsapp ? (
              <WhatsAppButton d={d} block />
            ) : !d.public_email && d.links.length === 0 ? (
              <p className="muted small">Contacto a través de su clínica</p>
            ) : null}
          </div>
          {(d.public_email || d.links.length > 0) && (
            <ul className="facts muted">
              {d.public_email && <li><MailIcon /> <Link href={`mailto:${d.public_email}`}>{d.public_email}</Link></li>}
              {d.links.map((l) => (
                <li key={l}><LinkIcon /> <Link href={l} target="_blank" rel="noopener nofollow me">{new URL(l).hostname.replace(/^www\./, '')}</Link></li>
              ))}
            </ul>
          )}
        </aside>

        <section className="profile-main">
          <div className="box">
            <div className="box-header">Detalles</div>
            <div className="box-body">
              <p><StatusLabel f={f} /> <span className="muted small">{f.text}</span></p>
              {d.regulator && (
                <>
                  <p>
                    {d.license_number
                      ? <>Licencia <strong>{d.regulator} {d.license_number}</strong> <span className="muted small">(declarada por el profesional)</span></>
                      : <>Registrado en <strong>{d.regulator}</strong> <span className="muted small">(prefiere no publicar el número)</span></>}
                  </p>
                  <p><Button as="a" href={REGISTRY[d.regulator]} target="_blank" rel="noopener" size="small">Comprobar en el registro oficial</Button></p>
                </>
              )}
              {(d.hours_weekday_open || d.hours_weekend_open) && (
                <p className="small">
                  <ClockIcon />{' '}
                  {[
                    d.hours_weekday_open && `Entre semana ${formatHours(d.hours_weekday_open, d.hours_weekday_close)}`,
                    d.hours_weekend_open && `Fin de semana ${formatHours(d.hours_weekend_open, d.hours_weekend_close)}`,
                  ].filter(Boolean).join(' · ')}
                  <br /><span className="muted small">Según el profesional; puede cambiar.</span>
                </p>
              )}
              <p className="muted small"><Where d={d} /></p>
              {f.kind !== 'unclaimed' && <p><ReportButton slug={d.slug} name={d.full_name} /></p>}
            </div>
          </div>

          {(d.insurances.length > 0 || d.insurance_url || (d.clinic_insurers ?? []).length > 0) && (
            <div className="box">
              <div className="box-header">Seguros</div>
              <div className="box-body">
                <InsuranceLabels d={d} all />
                <p className="muted small">
                  La cobertura depende de tu <strong>plan y red</strong>, no solo de la aseguradora: una clínica puede aceptar
                  Daman Enhanced pero no Daman Basic. Mira el nombre de la red en tu tarjeta y compruébalo antes de la cita.
                </p>
                {d.insurance_url && (
                  <p><Button as="a" href={d.insurance_url} target="_blank" rel="noopener nofollow" size="small">Ver la lista de seguros de la clínica</Button></p>
                )}
              </div>
            </div>
          )}

          {f.kind !== 'unclaimed' && (
            <div className="box">
              <div className="box-header">
                {confirmedCount === 1 ? '1 confirmación' : `${confirmedCount} confirmaciones`} en el último año
              </div>
              <div className="box-body">
                <ol className="graph" aria-label="Confirmaciones por mes">
                  {months.map((m) => {
                    const label = MONTH.format(new Date(`${m.month}-01T00:00:00Z`))
                    return (
                      <li key={m.month} title={`${label}: ${m.confirmed ? 'confirmó' : 'sin confirmación'}`}>
                        <span className={m.confirmed ? 'cell on' : 'cell'} />
                        <span className="cell-label">{label}</span>
                        <span className="sr-only">{m.confirmed ? 'confirmó' : 'sin confirmación'}</span>
                      </li>
                    )
                  })}
                </ol>
                <p className="muted small">Cada profesional confirma sus datos una vez al mes.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
