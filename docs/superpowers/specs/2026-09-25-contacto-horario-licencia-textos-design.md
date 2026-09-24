# Contacto, horario, licencia opcional y textos inclusivos

**Fecha:** 2026-09-25
**Origen:** propuestas recogidas en el grupo de WhatsApp de sanitarios.

## Qué pidieron los profesionales

1. Enlace a su web, correo y redes sociales.
2. Horario de atención.
3. Que el número de licencia se pueda no publicar, como ya pasa con el WhatsApp.
4. "Contar con psicólogos, enfermeros y fisios también".

## Qué se ha decidido

| Propuesta | Decisión | Por qué |
|---|---|---|
| Correo | Campo público propio, opcional | El correo de entrar no se publica nunca (principio 6, PDPL) |
| Redes y web | Lista de enlaces, lista blanca de dominios, máximo 5 | Revierte la decisión previa de descartar redes; la lista blanca evita moderar a mano |
| Horario | Entre semana y fin de semana, con hora de inicio y fin | Estructurado pero corto; encaja con la semana laboral de EAU |
| Licencia | Obligatoria al registrarse, publicación opcional | Conserva la detección de duplicados y la revisión automática |
| Sin publicar | Se muestra el regulador, no el número | El paciente sabe dónde está registrado aunque no vea el número |
| Textos | "Sanitarios en español · Emiratos" y "profesional de la salud" | Fisios, psicólogos y enfermeros ya están en el directorio; el lenguaje los excluía |

**El punto 4 no necesita código.** En la base ya hay 18 perfiles de Fisioterapia, 6 de
Psicología, 2 de Enfermería, más Podología y Optometría. Lo que falta es lenguaje, no
funcionalidad.

## Riesgos aceptados

- **"Sanitarios" no es neutro en toda Latinoamérica.** En España es el término natural; en
  buena parte de Latinoamérica se dice "personal de salud". El grupo es mixto. Decisión del
  dueño del producto, tomada a conciencia.
- **Las redes vuelven después de haberse descartado.** El motivo original (señal comercial,
  contra el principio 1, más carga de moderación) sigue siendo válido. Lo que lo hace
  asumible es la lista blanca de dominios y el tope de 5 enlaces: nadie puede convertir su
  perfil en un árbol de enlaces, y no hay que revisar cada alta a mano.
- **El horario envejece.** Se apoya en que guardar el perfil **es** la confirmación mensual
  ([lib/onboarding.ts:88-90](../../../lib/onboarding.ts)), así que se revisa cada mes sin
  trabajo extra. Se publica con la etiqueta "según el médico".

## Contexto técnico que condiciona el diseño

- **El flujo `CONFIRMAR` del bot no existe.** [lib/bot.ts:9](../../../lib/bot.ts) responde
  "Muy pronto"; `bot_sessions` no se lee ni se escribe en ningún sitio. Hoy confirmar =
  entrar y pulsar "Guardar perfil". **Este lote no construye nada del bot.**
- **La vista pública se espeja a mano en tres sitios:** la migración, el tipo
  `PublicDoctor` de [lib/directory.ts](../../../lib/directory.ts) y las **dos** listas de
  columnas de [lib/doctors.ts](../../../lib/doctors.ts). Añadir un campo público obliga a
  tocar los tres.
- **Las migraciones no tienen vuelta atrás:** se aplican por orden alfabético de nombre,
  una vez cada una, cada archivo en su transacción ([scripts/migrate.ts](../../../scripts/migrate.ts)).
- **Regla del repo:** al cambiar la superficie pública se reescribe la vista entera con
  `create or replace view`, nunca `alter view`.

## Diseño

### 1. Migración `db/migrations/008_contacto_horario.sql`

Columnas nuevas en `doctors`, todas nulas salvo la última:

```
public_email        text
links               text[]      not null default '{}'
hours_weekday_open  time
hours_weekday_close time
hours_weekend_open  time
hours_weekend_close time
show_license        boolean     not null default true
```

`show_license` por defecto `true`: los perfiles que ya existen siguen publicando su
licencia exactamente igual que hoy. La migración no necesita relleno de datos.

Después, `create or replace view public_doctors` completa, añadiendo los campos nuevos con
el mismo enmascarado que el resto cuando `status = 'unclaimed'`, y una regla más:

```sql
case when status = 'unclaimed' or not show_license then null else license_number end as license_number
```

El regulador se sigue exponiendo siempre, para poder decir "Registrado en DHA".

### 2. Validación — `lib/profile.ts`

Todo determinista y sin E/S, que es lo que hace esta capa fácil de probar.

- `public_email`: opcional, formato de correo, ≤120 caracteres.
- `links`: una URL por línea, **máximo 5**, todas `https:`. La regla exacta, sin
  interpretaciones:
  1. Un enlace cuyo host sea (o termine en) `instagram.com`, `linkedin.com`, `tiktok.com`,
     `x.com`, `facebook.com` o `youtube.com` se acepta siempre.
  2. **Como máximo uno** de los cinco puede ser un host libre: la web propia del médico o
     de su clínica. El segundo host libre se rechaza con "Solo puedes añadir una página
     web, además de tus redes".
  3. Se rechaza cualquier acortador (`bit.ly`, `linktr.ee` y similares, lista explícita en
     el código), porque esconde el destino y anula la lista blanca.

  Mensajes de error en español, por campo, como el resto.
- Horario: las cuatro horas son opcionales, pero si hay una de un par tiene que estar la
  otra, y la apertura tiene que ser anterior al cierre.
- `show_license`: casilla; la licencia sigue siendo obligatoria.

### 3. Formulario — `components/ProfileForm.tsx`

- Correo público: campo propio, nunca prerrellenado con el de entrar.
- Enlaces: un `<textarea>`, un enlace por línea, con la lista de redes admitidas en el
  texto de ayuda.
- Horario: cuatro `<input type="time">` nativos, agrupados en "Entre semana" y "Fin de
  semana". Vacío = no se publica.
- Licencia: debajo del campo, casilla "Publicar mi número de licencia", marcada por
  defecto, con la explicación de que sin publicarlo solo se verá el regulador.
- **El texto del consentimiento cambia:** hoy dice "incluido mi número de licencia"
  ([ProfileForm.tsx:101](../../../components/ProfileForm.tsx)), y dejaría de ser cierto.

### 4. Web pública

**Perfil `/medico/[slug]`** — columna izquierda, bajo el botón de WhatsApp: el correo como
`mailto:` y los enlaces con un Octicon y el nombre del dominio, sin logos de marca
(principio: nada de marcas ajenas). En "Detalles": el horario con la etiqueta "según el
médico" y la licencia en una de sus dos formas, siempre con el botón al registro oficial:

- publicada → "Licencia DHA 12345 (declarada)"
- no publicada → "Registrado en DHA"

**La fila del listado no cambia**, salvo esa misma línea de licencia. Ya carga con
especialidad, emirato, clínica, idiomas, seguros, estado y foto.

### 5. Textos

Nombre del sitio: **"Sanitarios en español · Emiratos"** en `app/layout.tsx` (título,
`siteName`, marca), `components/NavDrawer.tsx`, `components/InviteColleague.tsx` y
`app/contacto.vcf/route.ts`.

En el cuerpo, "médico" pasa a "profesional de la salud": portada, contadores ("19
profesionales"), "¿Trabajas en salud y hablas español?", `/sobre`, `/privacidad`,
`lib/bot.ts`, `lib/email.ts` y `CONTACT_MESSAGE` de `lib/directory.ts`.

**`/privacidad` se reescribe**, no se retoca: enumera exactamente qué se publica y qué no,
y con correo y enlaces nuevos deja de ser cierta. Es el documento que sostiene el principio 6.

### 6. Revisión automática — `lib/review.ts`

El correo público se quita del payload que va a Bedrock, igual que ya se quita el teléfono
([review.ts:47](../../../lib/review.ts)). Los enlaces tampoco se envían: la lista blanca ya
es una barrera determinista y el modelo no aporta ahí.

### 7. Pruebas

- Unitarias de `lib/profile.ts`: lista blanca (acepta/rechaza), tope de 5, horas
  incoherentes, correo inválido, `show_license`.
- Integración contra el Postgres local: la vista pública oculta `license_number` cuando
  `show_license` es falso y sigue mostrando el regulador; `web_reader` sigue sin acceso a
  las tablas.
- Actualizar los tests que afirman textos: `tests/home.test.tsx`, `tests/directory.test.ts`,
  `tests/invite.test.ts`.

## Fuera de alcance

- Los comandos `CONFIRMAR` / `1` / `2` del bot y `bot_sessions`.
- Filtrar por "abierto ahora": el horario es informativo, no un índice.
- Recordatorios por correo del horario o de los enlaces.
