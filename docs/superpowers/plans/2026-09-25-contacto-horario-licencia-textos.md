# Contacto, horario, licencia opcional y textos inclusivos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada sanitario pueda publicar correo, enlaces y horario, decidir si se ve el número de su licencia, y que la web hable de "profesionales de la salud" en vez de solo "médicos".

**Architecture:** Dos entregas independientes, cada una con su migración. La entrega 1 (tareas 1–6) no añade datos de contacto: solo la casilla de publicar licencia y el renombrado, que es de bajo riesgo y se puede desplegar sola. La entrega 2 (tareas 7–12) añade correo, enlaces y horario. Las migraciones son irreversibles en este proyecto, así que cuanto más pequeña sea cada una, mejor.

**Tech Stack:** Next.js 16 (App Router, Server Components), TypeScript 5.9, Primer React, PostgreSQL 17 con el driver `postgres`, Vitest.

**Spec:** [docs/superpowers/specs/2026-09-25-contacto-horario-licencia-textos-design.md](../specs/2026-09-25-contacto-horario-licencia-textos-design.md)

## Global Constraints

- **Interfaz en español neutro; código y nombres de columna en inglés.**
- **Sin Tailwind.** Estilos con variables de Primer (`var(--fgColor-muted)`, `var(--base-size-16)`), nunca valores sueltos.
- **Server Components por defecto.** Lo que necesite estado va en un `"use client"` pequeño. **Nunca** pasar elementos de icono como prop (`leadingVisual={<Icon />}`) desde un Server Component: en producción rompe con "Element type is invalid". Se pasa el componente: `leadingVisual={Icon}`.
- **Migraciones hacia delante, sin rollback.** Se aplican por orden alfabético de nombre, una vez cada una (`scripts/migrate.ts`). Nombre: `NNN_snake_case.sql`, comentario inicial en español.
- **Al tocar la superficie pública se reescribe la vista entera** con `create or replace view public_doctors`, nunca `alter view`.
- **Toda columna pública se espeja en tres sitios:** la migración, el tipo `PublicDoctor` de `lib/directory.ts`, y **las dos** listas de columnas de `lib/doctors.ts` (`getPublicDoctors` y `getDoctorBySlug`).
- **El modelo de Bedrock nunca recibe teléfonos ni correos.**
- Tests: `npm test` (Vitest). Los de integración necesitan el Postgres local: `npm run db:up`.
- Mensajes de commit en español, cuerpo explicando el porqué, y la línea `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## Review Focus

Cinco cosas que la spec da por supuestas y que ningún test cubre hoy. Cada una tiene su test asignado a la tarea que toca ese código.

1. **Desmarcar "publicar licencia" no puede despublicar un perfil.** `saveOwnProfile` compara licencia y regulador para decidir si revisa de nuevo; si `show_license` cuenta como cambio de licencia, un sanitario publicado que solo oculta el número acabaría en "pendiente de revisar". → Tarea 3.
2. **Un perfil `unclaimed` no puede filtrar la licencia** aunque `show_license` sea `true` por defecto: el orden del `case` en la vista importa. → Tarea 1.
3. **Dominios que imitan a los de la lista blanca** (`instagram.com.evil.io`, `notinstagram.com`): comprobar "termina en" mal hecho los acepta. → Tarea 8.
4. **Horarios que cruzan la medianoche** (22:00–02:00, urgencias): la regla "apertura antes que cierre" los rechazaría injustamente. La decisión es rechazarlos con un mensaje claro, no aceptarlos en silencio. → Tarea 8.
5. **Correo pegado con `mailto:`, espacios o mayúsculas.** Es lo que hace la gente al copiar de su cliente de correo. → Tarea 8.

---

# ENTREGA 1 — Licencia opcional y textos

## Task 1: Migración `show_license` y vista pública

**Files:**
- Create: `db/migrations/008_show_license.sql`
- Modify: `db/seed.sql` (fila `dr-sebastian-rojas`)
- Test: `tests/permissions.integration.test.ts`

**Interfaces:**
- Produces: columna `doctors.show_license boolean not null default true`; la vista `public_doctors` devuelve `license_number = null` cuando `show_license` es falso, **manteniendo** `regulator` no nulo. Ese par (regulador presente + número nulo) es la señal que la interfaz usa para decir "Registrado en DHA".

- [ ] **Step 1: Escribir el test que falla**

En `tests/permissions.integration.test.ts`, después del test "WhatsApp público solo con consentimiento":

```ts
  it('la licencia no se publica si el profesional pidió ocultarla, pero sí el regulador', async () => {
    const [r] = await reader`select regulator, license_number from public_doctors where slug = 'dr-sebastian-rojas'`
    expect(r.regulator).toBe('DHA')
    expect(r.license_number).toBeNull()
  })

  it('un perfil sin reclamar nunca filtra la licencia aunque show_license sea el valor por defecto', async () => {
    const rows = await reader`select license_number from public_doctors where status = 'unclaimed'`
    expect(rows.every((r) => r.license_number === null)).toBe(true)
  })
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npm run db:up && npx vitest run tests/permissions.integration.test.ts`
Expected: FAIL — `license_number` vale `'DHA-10006'` en el primer test (la columna aún no existe, así que la vista no la enmascara).

- [ ] **Step 3: Escribir la migración**

Crear `db/migrations/008_show_license.sql`:

```sql
-- La licencia sigue siendo obligatoria al darse de alta (detecta duplicados y alimenta la revisión),
-- pero el profesional decide si se publica el número. El regulador se sigue viendo siempre.
alter table doctors add column show_license boolean not null default true;

create or replace view public_doctors as
select
  id, slug, full_name, specialty, clinic, area, emirate,
  case when status = 'unclaimed' then '{}'::text[] else languages end as languages,
  case when status = 'unclaimed' then '{}'::text[] else insurances end as insurances,
  case when status = 'unclaimed' then null else regulator end as regulator,
  case when status = 'unclaimed' then null else public_whatsapp end as public_whatsapp,
  status::text as status,
  case when status = 'unclaimed' then null else last_confirmed_at end as last_confirmed_at,
  case when status = 'unclaimed' or not show_license then null else license_number end as license_number,
  case when status = 'unclaimed' then null else insurance_url end as insurance_url,
  case when status = 'unclaimed' or photo is null then null else extract(epoch from photo_updated_at)::bigint end as photo_version
from doctors
where status in ('verified', 'stale', 'unclaimed');
```

- [ ] **Step 4: Marcar la fila de ejemplo**

En `db/seed.sql`, al final del archivo (después del `insert` de `doctors`), añadir:

```sql
-- Un perfil que registró su licencia pero pidió no publicar el número.
update doctors set show_license = false where slug = 'dr-sebastian-rojas';
```

- [ ] **Step 5: Ejecutar los tests y ver que pasan**

Run: `npx vitest run tests/permissions.integration.test.ts`
Expected: PASS, incluido el test que ya existía de que las migraciones son idempotentes.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/008_show_license.sql db/seed.sql tests/permissions.integration.test.ts
git commit -m "Licencia: columna show_license y vista que oculta el número si el profesional lo pide"
```

---

## Task 2: Validación de `show_license` en el formulario

**Files:**
- Modify: `lib/profile.ts`
- Test: `tests/profile.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `ProfileData` gana `show_license: boolean`. `parseProfileForm` lo lee de la casilla `show_license`. `lib/onboarding.ts` vuelca `ProfileData` en `doctors` con `tx({...fields})`, así que el nombre del campo **tiene que coincidir con el de la columna**.

- [ ] **Step 1: Escribir el test que falla**

En `tests/profile.test.ts`, dentro de `describe('formulario de perfil')`:

```ts
  it('publica la licencia por defecto y la oculta si se desmarca la casilla', () => {
    expect(parseProfileForm(form({ show_license: 'on' })).data?.show_license).toBe(true)
    const fd = form(); fd.delete('show_license')
    expect(parseProfileForm(fd).data?.show_license).toBe(false)
    expect(parseProfileForm(fd).errors).toBeUndefined()  // ocultarla no es un error: la licencia sigue siendo obligatoria
  })
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run tests/profile.test.ts`
Expected: FAIL — `show_license` es `undefined`.

- [ ] **Step 3: Implementar**

En `lib/profile.ts`, añadir el campo al tipo, justo después de `license_number`:

```ts
  license_number: string
  show_license: boolean
```

Y en `parseProfileForm`, junto al bloque de `public_whatsapp`:

```ts
  const show_license = !!fd.get('show_license')
```

Añadirlo al objeto devuelto:

```ts
  return { data: { full_name, specialty, clinic, area, emirate, languages, insurances, regulator, license_number, show_license, public_whatsapp, insurance_url } }
```

- [ ] **Step 4: Ejecutar los tests y ver que pasan**

Dos archivos construyen un `ProfileData` a mano y el compilador pedirá el campo nuevo. En ambos, dentro del ayudante `data()`, añadir `show_license: true,` justo después de `license_number`:

- `tests/onboarding.integration.test.ts` (ayudante `data()`, líneas 17-20)
- `tests/review.test.ts` (ayudante `data()`, líneas 8-11)

Run: `npx vitest run tests/profile.test.ts tests/review.test.ts tests/onboarding.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/profile.ts tests/profile.test.ts
git commit -m "Formulario: casilla para publicar o no el número de licencia"
```

---

## Task 3: Guardar sin despublicar el perfil

**Files:**
- Modify: `lib/onboarding.ts:85` (cálculo de `licenseChanged`)
- Test: `tests/onboarding.integration.test.ts`

**Interfaces:**
- Consumes: `ProfileData.show_license` de la tarea 2.
- Produces: garantía de que cambiar solo `show_license` deja el perfil en `verified`.

Esto es el punto 1 de Review Focus. Hoy `licenseChanged` compara número y regulador; `show_license` **no** debe entrar en esa comparación, y conviene fijarlo con un test para que nadie lo añada por descuido.

- [ ] **Step 1: Escribir el test que falla**

En `tests/onboarding.integration.test.ts`, usando los ayudantes que ya existen en ese archivo (`data()`, `OK`, `doctorBySlug`, `publicRow`):

```ts
  it('ocultar el número de licencia no despublica un perfil ya verificado', async () => {
    const perfil = { full_name: 'Dra. Oculta Licencia', license_number: '88881111' }
    const r = await signUp(sql, 'oculta@example.com', data(perfil), OK)
    expect(r.published).toBe(true)

    const saved = await saveOwnProfile(sql, 'oculta@example.com', data({ ...perfil, show_license: false }), OK)
    expect(saved).toBe('saved')
    expect(await doctorBySlug(r.slug)).toMatchObject({ status: 'verified', show_license: false })
    expect((await publicRow(r.slug)).license_number).toBeNull()
  })
```

- [ ] **Step 2: Ejecutarlo y ver que falla o pasa**

Run: `npx vitest run tests/onboarding.integration.test.ts`
Expected: PASS ya de entrada, porque `licenseChanged` solo mira número y regulador. **Si falla**, es que alguien metió `show_license` en la comparación: quitarlo de ahí.

Este es un test de regresión, no de desarrollo: su valor es fallar el día que alguien cambie esa línea.

- [ ] **Step 3: Dejar constancia en el código**

En `lib/onboarding.ts`, sobre la línea de `licenseChanged`:

```ts
    // Solo el número o la autoridad obligan a revisar de nuevo. Ocultar la licencia (show_license) no es un cambio de licencia.
    const licenseChanged = d.license_number !== data.license_number || d.regulator !== data.regulator
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run tests/onboarding.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding.ts tests/onboarding.integration.test.ts
git commit -m "Ocultar la licencia no cuenta como cambio de licencia (no despublica el perfil)"
```

---

## Task 4: La casilla en el formulario

**Files:**
- Modify: `components/ProfileForm.tsx` (campo de licencia y texto del consentimiento)
- Test: manual, con el servidor de desarrollo

**Interfaces:**
- Consumes: el campo `show_license` que lee `parseProfileForm` (tarea 2).
- Produces: `Initial` gana `show_license?: boolean` para que la casilla recuerde su valor al editar.

- [ ] **Step 1: Añadir el campo al tipo `Initial`**

```ts
  license_number?: string | null
  show_license?: boolean
```

- [ ] **Step 2: Cambiar el campo de licencia y añadir la casilla**

Sustituir la línea de `license_number` por:

```tsx
      {field('license_number', 'Número de licencia', { required: true, caption: 'La pedimos siempre: evita perfiles duplicados y suplantaciones.' })}
      <FormControl>
        <Checkbox name="show_license" defaultChecked={initial.show_license ?? true} />
        <FormControl.Label>Publicar mi número de licencia</FormControl.Label>
        <FormControl.Caption>Si lo dejas sin marcar, tu perfil dirá solo en qué autoridad estás registrado, con el enlace al registro oficial.</FormControl.Caption>
      </FormControl>
```

- [ ] **Step 3: Corregir el texto del consentimiento**

Hoy afirma que se publica la licencia, y con la casilla deja de ser cierto:

```tsx
        <FormControl.Label>Acepto que se publiquen en el directorio los datos profesionales que he rellenado.</FormControl.Label>
```

- [ ] **Step 4: Pasar el valor guardado desde la cuenta**

En `app/cuenta/page.tsx`, `initial` sale de `findDoctorByIdentity`, que hace `select *`, así que `show_license` ya viaja. Verificar que el tipo `Initial` no da error de compilación:

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 5: Comprobarlo a mano**

Run: `npm run dev`, entrar con el canal de correo, ir a `/cuenta`, desmarcar la casilla, guardar, y abrir el perfil público.
Expected: el perfil ya no muestra el número (esto se ve entero cuando esté la tarea 5).

- [ ] **Step 6: Commit**

```bash
git add components/ProfileForm.tsx
git commit -m "Formulario: casilla de publicar licencia y consentimiento que dice la verdad"
```

---

## Task 5: Cómo se ve la licencia no publicada

**Files:**
- Modify: `app/medico/[slug]/page.tsx:68-73`
- Modify: `components/DoctorRow.tsx:70-73`
- Test: `tests/home.test.tsx`

**Interfaces:**
- Consumes: de la vista pública, `regulator` no nulo con `license_number` nulo.
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Escribir el test que falla**

En `tests/home.test.tsx`, dentro de `describe('DoctorRow')`:

```ts
  it('sin número de licencia publicado, muestra solo la autoridad y el enlace para comprobar', () => {
    row({ license_number: null })
    expect(screen.getByText(/Registrado en DHA/)).toBeTruthy()
    expect(screen.queryByText(/Licencia DHA/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Comprobar' })).toBeTruthy()
  })
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run tests/home.test.tsx`
Expected: FAIL — hoy pinta "Licencia DHA null".

- [ ] **Step 3: Implementar en la fila**

En `components/DoctorRow.tsx`, sustituir el bloque del regulador:

```tsx
        {d.regulator && (
          <span>
            {' · '}
            {d.license_number ? `Licencia ${d.regulator} ${d.license_number}` : `Registrado en ${d.regulator}`}
            {' · '}
            <Link href={REGISTRY[d.regulator]} target="_blank" rel="noopener">Comprobar</Link>
          </span>
        )}
```

- [ ] **Step 4: Implementar en el perfil**

En `app/medico/[slug]/page.tsx`, sustituir el párrafo de la licencia:

```tsx
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
```

- [ ] **Step 5: Ejecutar los tests**

Run: `npx vitest run tests/home.test.tsx`
Expected: PASS los cuatro tests del `describe`.

- [ ] **Step 6: Commit**

```bash
git add app/medico/\[slug\]/page.tsx components/DoctorRow.tsx tests/home.test.tsx
git commit -m "Perfil y listado: 'Registrado en DHA' cuando el número no se publica"
```

---

## Task 6: Renombrado a "Sanitarios en español" y "profesionales de la salud"

**Files:**
- Modify: `app/layout.tsx:12,14,15,27,38`
- Modify: `app/page.tsx:55,56,76,88,94,97,105,115,116,121`
- Modify: `app/medico/[slug]/page.tsx:70,113`, `app/medico/[slug]/not-found.tsx:7`
- Modify: `app/cuenta/page.tsx:46,49`, `app/cuenta/listo/page.tsx:31`
- Modify: `app/sobre/page.tsx:4,13,14,17,20`, `app/privacidad/page.tsx:10,14,15,19,23`
- Modify: `app/contacto.vcf/route.ts:6,12`
- Modify: `components/NavDrawer.tsx:18`, `components/SearchForm.tsx:11`, `components/StatusLabel.tsx:11`, `components/DoctorRow.tsx:40`, `components/ReportButton.tsx:40`, `components/InviteColleague.tsx:6,7,16`
- Modify: `lib/bot.ts:3`, `lib/email.ts:17,22,38`, `lib/directory.ts:96`
- Test: `tests/directory.test.ts:74`, `tests/profile.test.ts:63,65`

**Interfaces:**
- Produces: el nombre del sitio es **"Sanitarios en español · Emiratos"**; en el cuerpo se dice **"profesional de la salud"** (plural "profesionales").

- [ ] **Step 1: Actualizar los tests primero**

En `tests/directory.test.ts:74`:

```ts
    expect(decodeURIComponent(link.split('text=')[1])).toMatch(/^Hola, vi su perfil en el directorio de sanitarios en español/)
```

En `tests/profile.test.ts:63,65`, cambiar `'Directorio Médicos en español'` por `'Directorio Sanitarios en español'` en ambas líneas.

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx vitest run tests/directory.test.ts tests/profile.test.ts`
Expected: FAIL en los dos archivos.

- [ ] **Step 3: Cambiar el nombre del sitio**

`app/layout.tsx`:

```tsx
  title: { default: 'Sanitarios en español · Emiratos', template: '%s · Sanitarios en español' },
  description:
    'Directorio gratuito y comunitario de profesionales de la salud que atienden en español en los Emiratos Árabes Unidos. Cada profesional mantiene su perfil y confirma sus datos una vez al mes.',
  openGraph: { locale: 'es_ES', type: 'website', siteName: 'Sanitarios en español · Emiratos' },
```

Línea 27: `label: 'Soy profesional: entrar'`. Línea 38: `<a href="/" className="brand">Sanitarios en español · Emiratos</a>`.

`components/NavDrawer.tsx:18`: `title="Sanitarios en español"`.
`components/InviteColleague.tsx:16`: `title: 'Sanitarios en español · Emiratos'`.
`app/contacto.vcf/route.ts:6`: `name: 'Directorio Sanitarios en español'`; línea 12: `filename="directorio-sanitarios.vcf"`.

- [ ] **Step 4: Cambiar los textos de la portada**

`app/page.tsx`:

```tsx
        <Heading as="h1" className="hero-title">Profesionales de la salud que te atienden en español</Heading>
        <p className="muted">Cada profesional mantiene su propio perfil y confirma sus datos una vez al mes. Si pasa más de un mes sin confirmar, aparece como pendiente; a los tres meses se oculta.</p>
```

Línea 76: `{results.length === 1 ? '1 profesional' : `${results.length} profesionales`}`.
Línea 88: `'No hay profesionales con esos filtros. Prueba con otro emirato o seguro.'` y `'El directorio se está llenando. Si trabajas en salud y hablas español, sé de los primeros en aparecer.'`.
Línea 94: `aria-label="Para profesionales de la salud"`.
Línea 97: `<Heading as="h2" className="side-title">¿Trabajas en salud y hablas español?</Heading>`.
Línea 105: `'¿Conoces a alguien que atienda en español?'`.
Línea 115: `<li><strong>Escribes</strong> al profesional por WhatsApp o contactas su clínica.</li>`.
Línea 116: `<li><strong>Cada profesional confirma</strong> sus datos una vez al mes; si no, se marca como pendiente.</li>`.
Línea 121: `<span className="muted small">profesionales</span>`.

- [ ] **Step 5: Cambiar el resto de páginas y componentes**

- `app/medico/[slug]/page.tsx:113`: `'Cada profesional confirma sus datos una vez al mes.'`
- `app/medico/[slug]/not-found.tsx:7`: `'Puede que ya no esté en el directorio.'`
- `app/cuenta/page.tsx:46`: `no necesitas un perfil de profesional`; `:49`: `<summary>¿También atiendes pacientes? Crea tu perfil</summary>`
- `app/cuenta/listo/page.tsx:31`: `'¿Conoces a otro profesional que atienda en español?'`
- `app/sobre/page.tsx`: descripción y los tres `<strong>` pasan a "profesional"; la línea 20, `'Es un proyecto pro-bono: gratis para profesionales y pacientes…'`
- `app/privacidad/page.tsx`: las cinco líneas cambian "del médico" por "del profesional"
- `components/SearchForm.tsx:11`: `aria-label="Buscar profesional"`
- `components/StatusLabel.tsx:11`: `<title>Confirmado: confirmó sus datos este mes</title>`
- `components/DoctorRow.tsx:40`: `title={own ? 'Declarado por el profesional' : 'Según la web de la clínica'}`
- `components/ReportButton.tsx:40`: `…hasta que el profesional confirme sus datos. Nadie tiene que borrarlo a mano.`
- `components/InviteColleague.tsx:6,7`: `'Estoy en el directorio gratuito de sanitarios que atienden en español en los Emiratos. Crear tu perfil lleva 2 minutos:'` y `'Directorio gratuito de sanitarios que atienden en español en los Emiratos. Si trabajas en salud, crear tu perfil lleva 2 minutos:'`
- `lib/bot.ts:3`: `'Soy el bot del directorio de sanitarios en español. Para entrar en la web, envía el mensaje CODIGO que te muestra la página. Pronto podrás confirmar tus datos escribiendo CONFIRMAR.'`
- `lib/email.ts:17,22,38`: "directorio de sanitarios en español", asunto igual pero con "sanitarios", y la firma `Directorio de sanitarios en español · Emiratos`
- `lib/directory.ts:96`: `'Hola, vi su perfil en el directorio de sanitarios en español y quisiera pedir una cita.'`

- [ ] **Step 6: Comprobar que no queda nada suelto**

Run: `grep -rn "médicos en español\|Médicos en español" app components lib scripts tests`
Expected: sin resultados. Las URL `/medico/[slug]` y el parámetro `?medico=` **no se tocan**: cambiarlos rompería los enlaces ya compartidos.

- [ ] **Step 7: Ejecutar toda la batería**

Run: `npm test`
Expected: PASS 196+.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Textos: sanitarios y profesionales de la salud, no solo médicos"
```

---

## Task 7: Desplegar la entrega 1

- [ ] **Step 1: Comprobar la compilación de producción**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 2: Subir y desplegar**

```bash
git push origin main
aws ssm send-command --region eu-north-1 --instance-ids i-0dd6e50debd886ccb \
  --document-name AWS-RunShellScript --timeout-seconds 900 \
  --parameters 'commands=["sudo -u dochis HOME=/home/dochis bash /opt/dochis/scripts/deploy.sh"],executionTimeout=["900"]'
```

- [ ] **Step 3: Verificar en producción**

Run: `curl -s "https://dochis.pages.dev/" | grep -c "profesionales"`
Expected: al menos 1. Y comprobar que la migración corrió: la salida del despliegue dice `Aplicadas: 008_show_license.sql`.

---

# ENTREGA 2 — Correo, enlaces y horario

## Task 8: Validación de correo, enlaces y horario

**Files:**
- Modify: `lib/profile.ts`
- Test: `tests/profile.test.ts`

**Interfaces:**
- Produces: `ProfileData` gana `public_email: string | null`, `links: string[]`, `hours_weekday_open|close` y `hours_weekend_open|close` (`string | null`, formato `HH:MM`). Nombres idénticos a las columnas de la tarea 9.

Aquí viven los puntos 3, 4 y 5 de Review Focus.

- [ ] **Step 1: Escribir los tests que fallan**

En `tests/profile.test.ts`:

```ts
  it('acepta las redes de la lista y una sola web propia', () => {
    const links = ['https://instagram.com/dra.lucia', 'https://www.linkedin.com/in/lucia', 'https://clinicapalmera.ae'].join('\n')
    expect(parseProfileForm(form({ links })).data?.links).toHaveLength(3)
  })

  it('rechaza dominios que imitan a los de la lista', () => {
    for (const bad of ['https://instagram.com.evil.io/x', 'https://notinstagram.com/x', 'https://bit.ly/x', 'https://linktr.ee/x']) {
      const r = parseProfileForm(form({ links: ['https://instagram.com/ok', bad].join('\n') }))
      expect(r.errors?.links, bad).toBeTruthy()
    }
  })

  it('solo admite una web libre, y como mucho cinco enlaces', () => {
    const dos = ['https://clinicapalmera.ae', 'https://otraclinica.ae'].join('\n')
    expect(parseProfileForm(form({ links: dos })).errors?.links).toMatch(/una página web/)
    const seis = Array.from({ length: 6 }, (_, i) => `https://instagram.com/c${i}`).join('\n')
    expect(parseProfileForm(form({ links: seis })).errors?.links).toMatch(/cinco/)
  })

  it('limpia el correo público y rechaza el que no lo es', () => {
    expect(parseProfileForm(form({ public_email: '  MAILTO:Lucia@Clinica.AE ' })).data?.public_email).toBe('lucia@clinica.ae')
    expect(parseProfileForm(form({ public_email: 'lucia arroba clinica' })).errors?.public_email).toBeTruthy()
  })

  it('exige las dos horas de cada franja y que la apertura sea antes que el cierre', () => {
    const ok = parseProfileForm(form({ hours_weekday_open: '09:00', hours_weekday_close: '17:00' }))
    expect(ok.errors).toBeUndefined()
    expect(ok.data?.hours_weekday_open).toBe('09:00')
    expect(parseProfileForm(form({ hours_weekday_open: '09:00' })).errors?.hours_weekday).toMatch(/las dos horas/)
    expect(parseProfileForm(form({ hours_weekday_open: '22:00', hours_weekday_close: '02:00' })).errors?.hours_weekday).toMatch(/antes/)
  })
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx vitest run tests/profile.test.ts`
Expected: FAIL en los cinco.

- [ ] **Step 3: Implementar**

En `lib/profile.ts`, sobre `parseProfileForm`:

```ts
// Redes admitidas. La comprobación es por host exacto o subdominio ("instagram.com" o "www.instagram.com"),
// nunca "contiene": "instagram.com.evil.io" no es Instagram.
export const SOCIAL_HOSTS = ['instagram.com', 'linkedin.com', 'tiktok.com', 'x.com', 'facebook.com', 'youtube.com'] as const
// Los acortadores esconden el destino y anularían la lista blanca.
const SHORTENERS = ['bit.ly', 'linktr.ee', 'tinyurl.com', 't.co', 'lnk.bio', 'beacons.ai']
const MAX_LINKS = 5

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')
const isOn = (host: string, list: readonly string[]) => list.some((d) => host === d || host.endsWith(`.${d}`))

export function parseLinks(raw: string): { links?: string[]; error?: string } {
  const lines = [...new Set(raw.split('\n').map((l) => l.trim()).filter(Boolean))]
  if (lines.length > MAX_LINKS) return { error: `Como mucho cinco enlaces.` }
  let free = 0
  for (const l of lines) {
    let host: string
    try {
      if (new URL(l).protocol !== 'https:') return { error: 'Los enlaces tienen que empezar por https://' }
      host = hostOf(l)
    } catch { return { error: `Ese enlace no es válido: ${l}` } }
    if (isOn(host, SHORTENERS)) return { error: 'No admitimos acortadores de enlaces: pega la dirección completa.' }
    if (isOn(host, SOCIAL_HOSTS)) continue
    if (++free > 1) return { error: 'Solo puedes añadir una página web, además de tus redes.' }
  }
  return { links: lines }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
export function parseHours(open: string, close: string): { open: string | null; close: string | null; error?: string } {
  if (!open && !close) return { open: null, close: null }
  if (!open || !close) return { open: null, close: null, error: 'Escribe las dos horas, la de apertura y la de cierre.' }
  if (!HHMM.test(open) || !HHMM.test(close)) return { open: null, close: null, error: 'Usa el formato 09:00.' }
  if (open >= close) return { open: null, close: null, error: 'La hora de apertura tiene que ser antes que la de cierre. Si cierras pasada la medianoche, pon la hora de cierre real del día.' }
  return { open, close }
}
```

Dentro de `parseProfileForm`, antes del `consent`:

```ts
  let public_email: string | null = text(fd, 'public_email').replace(/^mailto:/i, '').trim().toLowerCase() || null
  if (public_email && (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(public_email) || public_email.length > MAX_TEXT)) {
    errors.public_email = 'Escribe un correo válido, o déjalo vacío.'
    public_email = null
  }

  const parsedLinks = parseLinks(text(fd, 'links'))
  if (parsedLinks.error) errors.links = parsedLinks.error
  const links = parsedLinks.links ?? []

  const weekday = parseHours(text(fd, 'hours_weekday_open'), text(fd, 'hours_weekday_close'))
  if (weekday.error) errors.hours_weekday = weekday.error
  const weekend = parseHours(text(fd, 'hours_weekend_open'), text(fd, 'hours_weekend_close'))
  if (weekend.error) errors.hours_weekend = weekend.error
```

Y al tipo `ProfileData` y al objeto devuelto:

```ts
  public_email: string | null
  links: string[]
  hours_weekday_open: string | null
  hours_weekday_close: string | null
  hours_weekend_open: string | null
  hours_weekend_close: string | null
```

```ts
    public_email, links,
    hours_weekday_open: weekday.open, hours_weekday_close: weekday.close,
    hours_weekend_open: weekend.open, hours_weekend_close: weekend.close,
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run tests/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/profile.ts tests/profile.test.ts
git commit -m "Validación de correo público, enlaces con lista blanca y horario"
```

---

## Task 9: Migración de contacto y horario

**Files:**
- Create: `db/migrations/009_contacto_horario.sql`
- Modify: `lib/directory.ts` (tipo `PublicDoctor`), `lib/doctors.ts` (las dos listas de columnas)
- Test: `tests/permissions.integration.test.ts`

**Interfaces:**
- Consumes: los nombres de campo de la tarea 8.
- Produces: `PublicDoctor` gana `public_email`, `links`, y las cuatro horas como `string | null` (`HH:MM`).

- [ ] **Step 1: Escribir el test que falla**

```ts
  it('publica correo, enlaces y horario solo de perfiles reclamados', async () => {
    const rows = await reader`select status, public_email, links, hours_weekday_open from public_doctors`
    for (const r of rows.filter((x) => x.status === 'unclaimed')) {
      expect(r.public_email).toBeNull()
      expect(r.links).toEqual([])
      expect(r.hours_weekday_open).toBeNull()
    }
  })
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run tests/permissions.integration.test.ts`
Expected: FAIL — `column "public_email" does not exist`.

- [ ] **Step 3: Escribir la migración**

`db/migrations/009_contacto_horario.sql`:

```sql
-- Contacto y horario, todo opcional. El correo de entrar (doctors.email) nunca se publica:
-- public_email es un campo aparte que el profesional escribe a propósito.
alter table doctors
  add column public_email text,
  add column links text[] not null default '{}',
  add column hours_weekday_open time,
  add column hours_weekday_close time,
  add column hours_weekend_open time,
  add column hours_weekend_close time;

create or replace view public_doctors as
select
  id, slug, full_name, specialty, clinic, area, emirate,
  case when status = 'unclaimed' then '{}'::text[] else languages end as languages,
  case when status = 'unclaimed' then '{}'::text[] else insurances end as insurances,
  case when status = 'unclaimed' then null else regulator end as regulator,
  case when status = 'unclaimed' then null else public_whatsapp end as public_whatsapp,
  status::text as status,
  case when status = 'unclaimed' then null else last_confirmed_at end as last_confirmed_at,
  case when status = 'unclaimed' or not show_license then null else license_number end as license_number,
  case when status = 'unclaimed' then null else insurance_url end as insurance_url,
  case when status = 'unclaimed' or photo is null then null else extract(epoch from photo_updated_at)::bigint end as photo_version,
  case when status = 'unclaimed' then null else public_email end as public_email,
  case when status = 'unclaimed' then '{}'::text[] else links end as links,
  case when status = 'unclaimed' then null else to_char(hours_weekday_open, 'HH24:MI') end as hours_weekday_open,
  case when status = 'unclaimed' then null else to_char(hours_weekday_close, 'HH24:MI') end as hours_weekday_close,
  case when status = 'unclaimed' then null else to_char(hours_weekend_open, 'HH24:MI') end as hours_weekend_open,
  case when status = 'unclaimed' then null else to_char(hours_weekend_close, 'HH24:MI') end as hours_weekend_close
from doctors
where status in ('verified', 'stale', 'unclaimed');
```

`to_char` devuelve ya el `HH:MM` que espera la interfaz: así el driver no entrega objetos de hora y no hay que convertir en TypeScript.

- [ ] **Step 4: Espejar en TypeScript los tres sitios**

`lib/directory.ts`, en `PublicDoctor`, tras `insurance_url`:

```ts
  public_email: string | null
  links: string[]
  hours_weekday_open: string | null
  hours_weekday_close: string | null
  hours_weekend_open: string | null
  hours_weekend_close: string | null
```

`lib/doctors.ts`, en **las dos** consultas, añadir a la lista de columnas:

```
           public_email, links, hours_weekday_open, hours_weekday_close, hours_weekend_open, hours_weekend_close
```

- [ ] **Step 5: Ejecutar los tests**

Dos archivos construyen un `PublicDoctor` a mano: el objeto `base` de `tests/home.test.tsx` (líneas 12-17) y el ayudante `doc()` de `tests/directory.test.ts` (líneas 10-14). En los dos, añadir esta línea antes del `...over` / del cierre:

```ts
  public_email: null, links: [], hours_weekday_open: null, hours_weekday_close: null, hours_weekend_open: null, hours_weekend_close: null,
```

Run: `npx vitest run tests/permissions.integration.test.ts && npx tsc --noEmit -p .`
Expected: PASS y sin errores de tipos.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/009_contacto_horario.sql lib/directory.ts lib/doctors.ts tests/
git commit -m "Contacto y horario en la base de datos y en la vista pública"
```

---

## Task 10: El correo público nunca llega al modelo

**Files:**
- Modify: `lib/review.ts:47`
- Test: `tests/review.test.ts`

**Interfaces:**
- Consumes: `ProfileData.public_email` y `links` de la tarea 8.

- [ ] **Step 1: Escribir el test que falla**

En `tests/review.test.ts`, **sustituyendo** el test que hoy se llama `'nunca envía el teléfono al modelo'`, que este amplía:

```ts
  it('nunca envía al modelo el teléfono, el correo ni los enlaces', async () => {
    const invoke = vi.fn().mockResolvedValue('{"problemas": []}')
    await llmIssues(data({ public_whatsapp: '+971501234567', public_email: 'lucia@clinica.ae', links: ['https://instagram.com/lucia'] }), invoke)
    const prompt = invoke.mock.calls[0][0]
    expect(prompt).not.toContain('+971501234567')
    expect(prompt).not.toContain('lucia@clinica.ae')
    expect(prompt).not.toContain('instagram.com/lucia')
  })
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run tests/review.test.ts`
Expected: FAIL — el correo y los enlaces aparecen en el prompt.

- [ ] **Step 3: Implementar**

```ts
    // El modelo nunca ve datos de contacto: ni teléfono, ni correo, ni enlaces (la lista blanca ya filtra los enlaces).
    const { public_whatsapp: _phone, public_email: _email, links: _links, ...professional } = data
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run tests/review.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/review.ts tests/review.test.ts
git commit -m "Revisión: el modelo tampoco ve el correo público ni los enlaces"
```

---

## Task 11: Los campos nuevos en el formulario

**Files:**
- Modify: `components/ProfileForm.tsx`

**Interfaces:**
- Consumes: los nombres de campo de la tarea 8 (`public_email`, `links`, `hours_*`).
- Produces: `Initial` gana los mismos campos, opcionales.

- [ ] **Step 1: Ampliar `Initial`**

```ts
  public_email?: string | null
  links?: string[]
  hours_weekday_open?: string | null; hours_weekday_close?: string | null
  hours_weekend_open?: string | null; hours_weekend_close?: string | null
```

- [ ] **Step 2: Añadir los campos, después del bloque de WhatsApp**

```tsx
      <FormControl>
        <FormControl.Label>Correo para pacientes (opcional)</FormControl.Label>
        <TextInput name="public_email" type="email" inputMode="email" defaultValue={initial.public_email ?? ''} block />
        <FormControl.Caption>Se publica tal cual. No es el correo con el que entras: ese no se publica nunca.</FormControl.Caption>
        {err.public_email && <FormControl.Validation variant="error">{err.public_email}</FormControl.Validation>}
      </FormControl>

      <FormControl>
        <FormControl.Label>Enlaces (opcional)</FormControl.Label>
        <Textarea name="links" defaultValue={(initial.links ?? []).join('\n')} rows={3} block placeholder={'https://instagram.com/tu-cuenta\nhttps://tuclinica.ae'} />
        <FormControl.Caption>Uno por línea, hasta cinco: Instagram, LinkedIn, TikTok, X, Facebook, YouTube y una página web.</FormControl.Caption>
        {err.links && <FormControl.Validation variant="error">{err.links}</FormControl.Validation>}
      </FormControl>

      <fieldset className="hours">
        <legend>Horario de atención (opcional)</legend>
        <FormControl>
          <FormControl.Label>Entre semana</FormControl.Label>
          <div className="hours-row">
            <TextInput name="hours_weekday_open" type="time" defaultValue={initial.hours_weekday_open ?? ''} />
            <TextInput name="hours_weekday_close" type="time" defaultValue={initial.hours_weekday_close ?? ''} />
          </div>
          {err.hours_weekday && <FormControl.Validation variant="error">{err.hours_weekday}</FormControl.Validation>}
        </FormControl>
        <FormControl>
          <FormControl.Label>Fin de semana</FormControl.Label>
          <div className="hours-row">
            <TextInput name="hours_weekend_open" type="time" defaultValue={initial.hours_weekend_open ?? ''} />
            <TextInput name="hours_weekend_close" type="time" defaultValue={initial.hours_weekend_close ?? ''} />
          </div>
          {err.hours_weekend && <FormControl.Validation variant="error">{err.hours_weekend}</FormControl.Validation>}
        </FormControl>
        <p className="muted small">Déjalo vacío si prefieres no publicarlo. Lo revisas cada mes al guardar tu perfil.</p>
      </fieldset>
```

Añadir `Textarea` a la importación de `@primer/react`.

- [ ] **Step 3: Estilos**

En `app/globals.css`:

```css
.hours { border: var(--borderWidth-thin) solid var(--borderColor-default); border-radius: var(--borderRadius-medium); padding: var(--base-size-16); margin: var(--base-size-16) 0; }
.hours legend { padding: 0 var(--base-size-8); font-weight: var(--base-text-weight-semibold); }
.hours-row { display: flex; gap: var(--base-size-8); align-items: center; }
```

- [ ] **Step 4: Comprobar**

Run: `npx tsc --noEmit -p . && npm run dev`
Expected: sin errores; en `/cuenta` se ven los campos y rechaza un enlace de `bit.ly`.

- [ ] **Step 5: Commit**

```bash
git add components/ProfileForm.tsx app/globals.css
git commit -m "Formulario: correo público, enlaces y horario"
```

---

## Task 12: Contacto y horario en el perfil público

**Files:**
- Modify: `app/medico/[slug]/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/directory.test.ts`

**Interfaces:**
- Consumes: los campos de `PublicDoctor` de la tarea 9.
- Produces: `formatHours(open, close)` exportada desde `lib/directory.ts`, usada solo por el perfil.

- [ ] **Step 1: Escribir el test que falla**

En `tests/directory.test.ts`:

```ts
describe('horario', () => {
  it('describe la franja o dice que no atiende', () => {
    expect(formatHours('09:00', '17:00')).toBe('9:00–17:00')
    expect(formatHours(null, null)).toBe('Sin horario publicado')
  })
})
```

Añadir `formatHours` a la importación desde `@/lib/directory`.

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run tests/directory.test.ts`
Expected: FAIL — `formatHours is not a function`.

- [ ] **Step 3: Implementar el formateo**

En `lib/directory.ts`:

```ts
// "09:00" se lee mejor como "9:00"; sin las dos horas no hay franja que enseñar.
export function formatHours(open: string | null, close: string | null): string {
  if (!open || !close) return 'Sin horario publicado'
  const trim = (h: string) => h.replace(/^0/, '')
  return `${trim(open)}–${trim(close)}`
}
```

- [ ] **Step 4: Pintar el contacto en el perfil**

En `app/medico/[slug]/page.tsx`, en la columna izquierda, después de `profile-actions`:

```tsx
          {(d.public_email || d.links.length > 0) && (
            <ul className="facts muted">
              {d.public_email && <li><MailIcon /> <Link href={`mailto:${d.public_email}`}>{d.public_email}</Link></li>}
              {d.links.map((l) => (
                <li key={l}><LinkIcon /> <Link href={l} target="_blank" rel="noopener nofollow me">{new URL(l).hostname.replace(/^www\./, '')}</Link></li>
              ))}
            </ul>
          )}
```

Importar `MailIcon` y `LinkIcon` de `@primer/octicons-react`. Son iconos genéricos, no logos de marca: el proyecto no usa marcas ajenas.

- [ ] **Step 5: Pintar el horario en "Detalles"**

Dentro de la caja de detalles, tras la licencia:

```tsx
              {(d.hours_weekday_open || d.hours_weekend_open) && (
                <p className="small">
                  <ClockIcon /> Entre semana {formatHours(d.hours_weekday_open, d.hours_weekday_close)}
                  {' · '}Fin de semana {formatHours(d.hours_weekend_open, d.hours_weekend_close)}
                  <br /><span className="muted small">Según el profesional; puede cambiar.</span>
                </p>
              )}
```

Importar `ClockIcon` y `formatHours`.

- [ ] **Step 6: Ejecutar la batería y comprobar a mano**

Run: `npm test && npm run dev`
Expected: PASS; en un perfil con datos se ven correo, enlaces y horario.

- [ ] **Step 7: Commit**

```bash
git add app/medico/\[slug\]/page.tsx lib/directory.ts app/globals.css tests/directory.test.ts
git commit -m "Perfil: correo, enlaces y horario de atención"
```

---

## Task 13: Reescribir la página de privacidad y actualizar CLAUDE.md

**Files:**
- Modify: `app/privacidad/page.tsx`
- Modify: `app/sobre/page.tsx` (el punto de las licencias)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Actualizar qué se publica**

En `app/privacidad/page.tsx`, la lista de datos públicos pasa a incluir, con estas palabras exactas:

```tsx
        <li>El correo de contacto y los enlaces, solo si el profesional los escribió en su perfil.</li>
        <li>El horario de atención, si lo publicó.</li>
        <li>El número de licencia, solo si marcó la casilla de publicarlo. Si no, se indica únicamente la autoridad en la que está registrado.</li>
```

Y en la lista de lo que **no** se publica, dejar explícito:

```tsx
        <li>El correo con el que entra, que es distinto del correo de contacto y nunca se publica.</li>
```

- [ ] **Step 2: Corregir `/sobre`**

El punto "Licencias comprobables" afirma que cada profesional declara su número; ahora es "lo declara al registrarse, y decide si se publica".

- [ ] **Step 3: Actualizar CLAUDE.md**

En "Modelo de datos", añadir a `doctors`: `public_email`, `links`, las cuatro horas y `show_license`. En "Roles", corregir que la licencia se publica solo con `show_license`. En "Diseño", el nombre del sitio. Y en el registro de decisiones:

```markdown
- **2026-09-25:** Correo de contacto, enlaces (lista blanca de seis redes más una web, sin acortadores) y horario de atención, todo opcional; la licencia se pide siempre pero se publica solo si el profesional lo marca (si no, se muestra el regulador). Textos de "médicos" a "sanitarios / profesionales de la salud": fisios, psicólogos y enfermeros ya estaban en el directorio y el lenguaje los dejaba fuera. Revierte la decisión de descartar redes sociales: la lista blanca y el tope de cinco enlaces evitan la moderación a mano.
```

- [ ] **Step 4: Ejecutar la batería y commit**

```bash
npm test
git add -A
git commit -m "Privacidad, /sobre y CLAUDE.md al día con el contacto y la licencia opcional"
```

---

## Task 14: Desplegar la entrega 2

- [ ] **Step 1: Compilación de producción**

Run: `npm run build`

- [ ] **Step 2: Subir y desplegar** (mismo comando que la tarea 7)

- [ ] **Step 3: Verificar**

Comprobar en la salida del despliegue que dice `Aplicadas: 009_contacto_horario.sql`, y abrir un perfil en `https://dochis.pages.dev`.
