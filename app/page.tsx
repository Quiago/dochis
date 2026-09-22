import { Button, Flash, Heading, Link } from '@primer/react'
import { SyncIcon, XIcon } from '@primer/octicons-react'
import DoctorRow from '@/components/DoctorRow'
import FilterMenus from '@/components/FilterMenus'
import InviteColleague, { VISITOR_MESSAGE } from '@/components/InviteColleague'
import SearchForm from '@/components/SearchForm'
import { getPublicDoctors } from '@/lib/doctors'
import {
  directoryStats, facetCounts, facets, filterDoctors, filterHref, FILTER_KEYS, parseFilters, shuffle,
  type Filters, type PublicDoctor,
} from '@/lib/directory'
import { loginChannels } from '@/lib/session'

// Random order on every visit: never cache this page.
export const dynamic = 'force-dynamic'

const MENUS: { key: Exclude<keyof Filters, 'q'>; all: string }[] = [
  { key: 'esp', all: 'Todas las especialidades' },
  { key: 'emirato', all: 'Todos los emiratos' },
  { key: 'seguro', all: 'Cualquier seguro' },
  { key: 'idioma', all: 'Cualquier idioma' },
  { key: 'estado', all: 'Cualquier estado' },
]

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams)
  let all: PublicDoctor[] = []
  let loadError = false
  try {
    all = await getPublicDoctors()
  } catch (e) {
    console.error(e)
    loadError = true
  }
  const options = facets(all)
  const counts = facetCounts(all)
  const stats = directoryStats(all)
  const results = shuffle(filterDoctors(all, filters))
  const hasFilters = FILTER_KEYS.some((k) => filters[k])
  const now = new Date()
  const channels = loginChannels()
  const cta = channels[0] === 'whatsapp' ? 'Entrar con WhatsApp' : 'Entrar con tu correo'

  return (
    <div className="dashboard">
      {/* Left column: like GitHub's "Top repositories". Alphabetical, never ranked. */}
      <aside className="dash-left" aria-label="Explorar">
        <SidebarList title="Especialidades" items={counts.esp} active={filters.esp} href={(v) => filterHref(filters, 'esp', v)} />
        <SidebarList title="Emiratos" items={counts.emirato} active={filters.emirato} href={(v) => filterHref(filters, 'emirato', v)} />
      </aside>

      <main className="dash-main">
        <Heading as="h1" className="hero-title">Médicos que te atienden en español</Heading>
        <p className="muted">Cada médico mantiene su propio perfil y confirma sus datos una vez al mes. Si pasa más de un mes sin confirmar, aparece como pendiente; a los tres meses se oculta.</p>

        <div className="searchbar">
          <SearchForm q={filters.q} hidden={MENUS.flatMap(({ key }) => (filters[key] ? [[key, filters[key]] as [string, string]] : []))} />
          <div className="filters">
            <FilterMenus
              menus={MENUS.map(({ key, all: allLabel }) => ({
                label: filters[key] ?? allLabel,
                items: [
                  { text: allLabel, href: filterHref(filters, key), active: !filters[key] },
                  ...options[key].map((v) => ({ text: v, href: filterHref(filters, key, v), active: filters[key] === v })),
                ],
              }))}
            />
            {hasFilters && <Link href="/" className="clear"><XIcon /> Quitar filtros</Link>}
          </div>
        </div>

        <div className="meta">
          <strong>{results.length === 1 ? '1 médico' : `${results.length} médicos`}</strong>
          {/* Plain reload: the server reshuffles on every request. */}
          <Button as="a" href={filterHref(filters, 'q', filters.q)} size="small" variant="invisible" leadingVisual={<SyncIcon />}>Mezclar orden</Button>
        </div>
        <p className="muted small">El orden es aleatorio en cada visita, para que no se recomiende siempre a los mismos.</p>

        {loadError ? (
          <Flash variant="danger">No pudimos cargar el directorio. Inténtalo de nuevo en unos minutos.</Flash>
        ) : results.length ? (
          <ul className="list">{results.map((d) => <DoctorRow key={d.id} d={d} now={now} />)}</ul>
        ) : (
          <div className="list empty muted">
            {all.length ? 'No hay médicos con esos filtros. Prueba con otro emirato o seguro.' : 'El directorio se está llenando. Si eres médico y hablas español, sé de los primeros en aparecer.'}
          </div>
        )}
      </main>

      {/* Right column: like GitHub's changelog panel. */}
      <aside className="dash-right" aria-label="Para médicos">
        <section className="box">
          <div className="box-body">
            <Heading as="h2" className="side-title">¿Eres médico y hablas español?</Heading>
            <p className="muted small">Crea o reclama tu perfil. Sin contraseñas: te enviamos un código. Verificamos tu licencia con la DHA, DOH o MOHAP.</p>
            {channels.length ? (
              <Button as="a" href="/entrar" variant="primary" block>{cta}</Button>
            ) : (
              <p className="muted small">El acceso está en mantenimiento.</p>
            )}
            <div className="invite-home">
              <p className="muted small">¿Conoces a un médico que atienda en español?</p>
              <InviteColleague url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/entrar`} message={VISITOR_MESSAGE} />
            </div>
          </div>
        </section>

        <section className="box">
          <div className="box-header">Cómo funciona</div>
          <ol className="steps small">
            <li><strong>Buscas</strong> por especialidad, emirato, seguro o idioma.</li>
            <li><strong>Escribes</strong> al médico por WhatsApp o contactas su clínica.</li>
            <li><strong>Cada médico confirma</strong> sus datos una vez al mes; si no, se marca como pendiente.</li>
          </ol>
        </section>

        <section className="box stats">
          <div><strong>{stats.doctors}</strong><span className="muted small">médicos</span></div>
          <div><strong>{stats.specialties}</strong><span className="muted small">especialidades</span></div>
          <div><strong>{stats.confirmedThisRound}</strong><span className="muted small">confirmados este mes</span></div>
        </section>

        <p className="muted small">Proyecto comunitario, gratuito y de código abierto. Sin anuncios ni perfiles pagados. <Link href="/sobre">Sobre el proyecto</Link></p>
      </aside>
    </div>
  )
}

function SidebarList({ title, items, active, href }: {
  title: string; items: { value: string; count: number }[]; active?: string; href: (v?: string) => string
}) {
  if (!items.length) return null
  return (
    <nav className="side-section" aria-label={title}>
      <Heading as="h2" className="side-heading">{title}</Heading>
      <ul className="side-list">
        {items.map(({ value, count }) => (
          <li key={value}>
            <Link href={value === active ? href() : href(value)} className={value === active ? 'side-link active' : 'side-link'} aria-current={value === active ? 'true' : undefined}>
              <span>{value}</span><span className="side-count">{count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
