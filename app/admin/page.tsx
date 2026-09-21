import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Button, Heading, Label, Link } from '@primer/react'
import { AlertIcon, CheckIcon, ClockIcon, IssueOpenedIcon, LinkExternalIcon, XIcon } from '@primer/octicons-react'
import AdminTabs from '@/components/AdminTabs'
import CopyButton from '@/components/CopyButton'
import { listReports, roundStart, unconfirmedThisRound } from '@/lib/freshness'
import { writer } from '@/lib/db'
import { getReviewer, listPendingRequests } from '@/lib/onboarding'
import { getSession } from '@/lib/session'
import { approve, dismiss, reject } from './actions'

export const metadata: Metadata = { title: 'Panel de revisión', robots: { index: false } }
export const dynamic = 'force-dynamic'

// Official license search per regulator (DOH has no public search page: its e-services portal).
const REGISTRY: Record<string, string> = {
  DHA: 'https://services.dha.gov.ae/sheryan/wps/portal/home/medical-directory',
  DOH: 'https://www.doh.gov.ae/en/eservices',
  MOHAP: 'https://smartforms.moh.gov.ae:83/ServicesProd/Pages/LicensedMedicalProfessionals.aspx?lang=en',
}
const DATE = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })
const fmt = (d: Date | string) => DATE.format(new Date(d))

const KIND: Record<string, string> = { signup: 'Alta marcada', license: 'Edición marcada', claim: 'Reclamo' }

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession()
  const reviewer = session && (await getReviewer(writer(), session.phone ?? session.email))
  if (!reviewer) notFound()
  const tab = (await searchParams).tab ?? 'pendientes'
  const sql = writer()
  const [requests, unconfirmed, reports] = await Promise.all([
    listPendingRequests(sql, reviewer), unconfirmedThisRound(sql, reviewer), listReports(sql, reviewer),
  ])
  const since = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(roundStart(new Date()))

  return (
    <main className="container">
      <Heading as="h1" className="admin-title">Panel de revisión</Heading>
      <p className="muted small">
        {reviewer.role === 'admin' ? 'Administrador' : `Embajador${reviewer.scope ? ` · ${reviewer.scope}` : ''}`}
      </p>
      <AdminTabs
        current={tab}
        tabs={[
          { key: 'pendientes', label: 'Marcados para revisar', count: requests.length },
          { key: 'sin-confirmar', label: 'Sin confirmar este mes', count: unconfirmed.length },
          { key: 'reportes', label: 'Reportes', count: reports.length },
        ]}
      />

      {tab === 'sin-confirmar' ? (
        <>
          <div className="admin-toolbar">
            <p className="muted small">No confirmaron desde el {since}. Copia los contactos para la lista de difusión (máx. 256 por lista).</p>
            <div className="actions">
              <CopyButton label="Copiar teléfonos" text={unconfirmed.flatMap((d) => d.phone_e164 ?? []).join('\n')} />
              <CopyButton label="Copiar correos" text={unconfirmed.flatMap((d) => d.email ?? []).join(', ')} />
            </div>
          </div>
          {unconfirmed.length === 0 ? <div className="list empty muted">Todos confirmaron en esta ronda.</div> : (
            <ul className="list">
              {unconfirmed.map((d) => (
                <li key={d.slug} className="row issue">
                  <ClockIcon className="issue-icon-muted" />
                  <div className="issue-body">
                    <Link href={`/medico/${d.slug}`}><strong>{d.full_name}</strong></Link>
                    <p className="muted small">
                      {d.specialty} · {[d.phone_e164, d.email].filter(Boolean).join(' · ') || 'sin contacto'} ·{' '}
                      {d.last_confirmed_at ? `confirmó el ${fmt(d.last_confirmed_at)}` : 'nunca confirmó'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : tab === 'reportes' ? (
        reports.length === 0 ? <div className="list empty muted">No hay reportes en los últimos 30 días.</div> : (
          <ul className="list">
            {reports.map((r) => (
              <li key={r.doctor_id} className="row issue">
                <AlertIcon className="issue-icon-attention" />
                <div className="issue-body">
                  <div className="row-head">
                    <Link href={`/medico/${r.slug}`}><strong>{r.full_name}</strong></Link>
                    <Label variant={r.status === 'stale' ? 'attention' : 'secondary'}>{r.count === 1 ? '1 reporte' : `${r.count} reportes`}</Label>
                  </div>
                  <p className="muted small">{r.specialty} · {r.reasons.join(', ')} · último el {fmt(r.last_at)}</p>
                </div>
                <div className="issue-actions">
                  <form action={dismiss}><input type="hidden" name="doctor_id" value={r.doctor_id} /><Button type="submit" size="small">Descartar reportes</Button></form>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : requests.length === 0 ? (
        <div className="list empty muted">Nada que revisar: la revisión automática publicó todo lo demás.</div>
      ) : (
        <ul className="list">
          {requests.map((r) => (
            <li key={r.id} className="row issue">
              <IssueOpenedIcon className="issue-icon" />
              <div className="issue-body">
                <div className="row-head">
                  <strong>{r.doctor_name}</strong>
                  <Label variant="attention">{KIND[r.kind] ?? r.kind}</Label>
                </div>
                {r.payload?.issues?.length > 0 && (
                  <ul className="issues small">{r.payload.issues.map((i: string) => <li key={i}>{i}</li>)}</ul>
                )}
                <p className="muted small">
                  {r.doctor_specialty} · licencia <strong>{r.regulator} {r.license_number}</strong> ·{' '}
                  <Link href={REGISTRY[r.regulator]} target="_blank" rel="noopener">buscar en el registro <LinkExternalIcon size={12} /></Link>
                </p>
                <p className="muted small">
                  Pedido por {r.identity} el {fmt(r.created_at)}

                </p>
              </div>
              <div className="issue-actions">
                <form action={approve}><input type="hidden" name="id" value={r.id} /><Button type="submit" size="small" leadingVisual={<CheckIcon />}>Aprobar</Button></form>
                <form action={reject}><input type="hidden" name="id" value={r.id} /><Button type="submit" size="small" variant="danger" leadingVisual={<XIcon />}>Rechazar</Button></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
