import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Button, Heading, Label, Link, RelativeTime } from '@primer/react'
import { CheckIcon, IssueOpenedIcon, LinkExternalIcon, XIcon } from '@primer/octicons-react'
import AdminTabs from '@/components/AdminTabs'
import { writer } from '@/lib/db'
import { getReviewer, listPendingRequests } from '@/lib/onboarding'
import { getSession } from '@/lib/session'
import { approve, reject } from './actions'

export const metadata: Metadata = { title: 'Panel de revisión', robots: { index: false } }
export const dynamic = 'force-dynamic'

// Official license search per regulator (DOH has no public search page: its e-services portal).
const REGISTRY: Record<string, string> = {
  DHA: 'https://services.dha.gov.ae/sheryan/wps/portal/home/medical-directory',
  DOH: 'https://www.doh.gov.ae/en/eservices',
  MOHAP: 'https://smartforms.moh.gov.ae:83/ServicesProd/Pages/LicensedMedicalProfessionals.aspx?lang=en',
}
const KIND: Record<string, string> = { signup: 'Alta nueva', claim: 'Reclamo de perfil', license: 'Cambio de licencia' }

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession()
  const reviewer = session && (await getReviewer(writer(), session.phone ?? session.email))
  if (!reviewer) notFound()
  const tab = (await searchParams).tab ?? 'pendientes'
  const requests = await listPendingRequests(writer(), reviewer)

  return (
    <main className="container">
      <Heading as="h1" className="admin-title">Panel de revisión</Heading>
      <p className="muted small">
        {reviewer.role === 'admin' ? 'Administrador' : `Embajador${reviewer.scope ? ` · ${reviewer.scope}` : ''}`}
      </p>
      <AdminTabs
        current={tab}
        tabs={[
          { key: 'pendientes', label: 'Pendientes de verificar', count: requests.length },
          { key: 'sin-confirmar', label: 'Sin confirmar esta ronda' },
          { key: 'reportes', label: 'Reportes' },
        ]}
      />

      {tab !== 'pendientes' ? (
        <div className="list empty muted">Esta sección llega con la confirmación trimestral y los reportes.</div>
      ) : requests.length === 0 ? (
        <div className="list empty muted">No hay solicitudes pendientes.</div>
      ) : (
        <ul className="list">
          {requests.map((r) => (
            <li key={r.id} className="row issue">
              <IssueOpenedIcon className="issue-icon" />
              <div className="issue-body">
                <div className="row-head">
                  <strong>{r.doctor_name}</strong>
                  <Label variant={r.kind === 'claim' ? 'attention' : 'accent'}>{KIND[r.kind]}</Label>
                </div>
                <p className="muted small">
                  {r.doctor_specialty} · licencia <strong>{r.regulator} {r.license_number}</strong> ·{' '}
                  <Link href={REGISTRY[r.regulator]} target="_blank" rel="noopener">buscar en el registro <LinkExternalIcon size={12} /></Link>
                </p>
                <p className="muted small">
                  Pedido por {r.identity} <RelativeTime date={new Date(r.created_at)} lang="es" />
                  {r.kind === 'claim' && <> · perfil <Link href={`/medico/${r.doctor_slug}`}>/{r.doctor_slug}</Link></>}
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
