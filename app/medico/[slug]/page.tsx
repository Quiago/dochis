import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Button, Heading, Link } from '@primer/react'
import { ArrowLeftIcon, LocationIcon, OrganizationIcon, VerifiedIcon } from '@primer/octicons-react'
import StatusLabel from '@/components/StatusLabel'
import Topics from '@/components/Topics'
import { WhatsAppButton, Where } from '@/components/DoctorRow'
import { getDoctorBySlug } from '@/lib/doctors'
import { confirmationMonths, freshness, initials } from '@/lib/directory'

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
          <div className="avatar" aria-hidden="true">{initials(d.full_name)}</div>
          <Heading as="h1" className="profile-name">{d.full_name}</Heading>
          <p className="row-spec">{d.specialty}</p>
          <ul className="facts muted">
            <li><OrganizationIcon /> {d.clinic}</li>
            <li><LocationIcon /> {d.area ? `${d.area}, ` : ''}{d.emirate}</li>
          </ul>
          <Topics items={d.languages} />
          <div className="profile-actions">
            {f.kind === 'unclaimed' ? (
              <Button as="a" href={`/entrar?medico=${d.slug}`} block>¿Eres tú? Reclama tu perfil</Button>
            ) : d.public_whatsapp ? (
              <WhatsAppButton d={d} block />
            ) : (
              <p className="muted small">Contacto a través de su clínica</p>
            )}
          </div>
        </aside>

        <section className="profile-main">
          <div className="box">
            <div className="box-header">Detalles</div>
            <div className="box-body">
              <p><StatusLabel f={f} /> <span className="muted small">{f.text}</span></p>
              {d.regulator && (
                <p className="license"><VerifiedIcon /> Licencia verificada con la {d.regulator}</p>
              )}
              <p className="muted small"><Where d={d} /></p>
            </div>
          </div>

          {d.insurances.length > 0 && (
            <div className="box">
              <div className="box-header">Seguros aceptados</div>
              <div className="box-body"><Topics items={d.insurances} /></div>
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
                <p className="muted small">Cada médico confirma sus datos por WhatsApp cada tres meses.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
