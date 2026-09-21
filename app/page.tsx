import { Button, Flash, Heading, Link, TextInput } from '@primer/react'
import { SearchIcon, SyncIcon, XIcon } from '@primer/octicons-react'
import DoctorRow from '@/components/DoctorRow'
import FilterMenus from '@/components/FilterMenus'
import { getPublicDoctors } from '@/lib/doctors'
import { facets, filterDoctors, filterHref, FILTER_KEYS, parseFilters, shuffle, type Filters, type PublicDoctor } from '@/lib/directory'

// Random order on every visit: never cache this page.
export const dynamic = 'force-dynamic'

const MENUS: { key: Exclude<keyof Filters, 'q'>; all: string }[] = [
  { key: 'esp', all: 'Todas las especialidades' },
  { key: 'emirato', all: 'Todos los emiratos' },
  { key: 'seguro', all: 'Cualquier seguro' },
  { key: 'idioma', all: 'Cualquier idioma' },
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
  const results = shuffle(filterDoctors(all, filters))
  const hasFilters = FILTER_KEYS.some((k) => filters[k])
  const now = new Date()

  return (
    <main className="container">
      <header className="hero">
        <Heading as="h1" className="hero-title">Médicos que te atienden en español</Heading>
        <p className="muted">
          Cada médico mantiene su propio perfil y lo confirma por WhatsApp cada tres meses. Si no lo confirma, se marca como pendiente.
        </p>
      </header>

      <div className="searchbar">
        <form method="get" action="/" role="search">
          {MENUS.map(({ key }) => filters[key] && <input key={key} type="hidden" name={key} value={filters[key]} />)}
          <TextInput
            name="q"
            type="search"
            block
            size="large"
            defaultValue={filters.q}
            placeholder="Nombre, especialidad o clínica"
            aria-label="Buscar médico"
            leadingVisual={<SearchIcon />}
          />
        </form>
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
          {hasFilters && (
            <Link href="/" className="clear">
              <XIcon /> Quitar filtros
            </Link>
          )}
        </div>
      </div>

      <div className="meta">
        <strong>{results.length === 1 ? '1 médico' : `${results.length} médicos`}</strong>
        {/* Plain reload: the server reshuffles on every request. */}
        <Button as="a" href={filterHref(filters, 'q', filters.q)} size="small" variant="invisible" leadingVisual={<SyncIcon />}>
          Mezclar orden
        </Button>
      </div>
      <p className="muted small">El orden es aleatorio en cada visita, para que no se recomiende siempre a los mismos.</p>

      {loadError ? (
        <Flash variant="danger">No pudimos cargar el directorio. Inténtalo de nuevo en unos minutos.</Flash>
      ) : results.length ? (
        <ul className="list">
          {results.map((d) => <DoctorRow key={d.id} d={d} now={now} />)}
        </ul>
      ) : (
        <div className="list empty muted">No hay médicos con esos filtros. Prueba con otro emirato o seguro.</div>
      )}

      <section className="cta">
        <Heading as="h2" className="cta-title">¿Eres médico y hablas español?</Heading>
        <p>Entra con tu número de WhatsApp, sin contraseñas ni correos. Verificamos tu licencia con la DHA, DOH o MOHAP.</p>
        <Button as="a" href="/entrar" variant="primary">Entrar con WhatsApp</Button>
      </section>
      <p className="muted small center">Proyecto comunitario, gratuito y de código abierto. Sin anuncios ni perfiles pagados.</p>
    </main>
  )
}
