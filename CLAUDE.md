# Directorio de médicos hispanohablantes en Emiratos

## Qué es
Directorio web gratuito y comunitario de médicos que atienden en español en los Emiratos Árabes Unidos. Nace de un grupo de WhatsApp de unos 350 sanitarios hispanos cuya lista en Google Sheets se mantenía a mano y estaba desactualizada.

## Problema que resuelve
- La lista la mantienen voluntarios a mano y ya no dan abasto.
- Los directorios oficiales filtran por nacionalidad, no por idioma, y están separados por regulador (DHA en Dubái, DOH en Abu Dabi, MOHAP en el resto).
- Siempre se recomiendan los mismos médicos.
- El correo no funciona para recordatorios: los médicos no lo leen. Viven en WhatsApp.

## Principios de producto (no romper)
1. **Pro-bono, siempre.** Gratis para médicos y pacientes. Sin anuncios, sin perfiles destacados pagados, sin venta de datos. La comunidad rechazó un intento anterior de app de pago; cualquier señal de negocio mata el proyecto. Código abierto (GPL-3.0).
2. **Cada médico es dueño de su perfil.** Ningún voluntario mantiene datos a mano.
3. **Cero trabajo extra para los médicos.** Entrar = escribir su número y el código que le llega por WhatsApp. Confirmar datos = tocar un enlace y enviar un mensaje de WhatsApp.
4. **Justicia en la visibilidad.** Orden aleatorio por defecto. Nada de rankings por popularidad.
5. **Frescura visible.** Cada perfil muestra cuándo se confirmó. Sin confirmación en 90 días pasa a "pendiente".
6. **Privacidad primero (PDPL de EAU).** El teléfono de login no se publica salvo consentimiento explícito para usarlo como contacto. Perfiles importados del Excel muestran solo nombre, especialidad y centro hasta que el médico los reclame.
7. **Filtrar por idioma, no por nacionalidad.**
8. **Gratis para los usuarios; infraestructura con créditos de AWS.** La operación se financia con los créditos del plan gratuito de AWS (hasta 200 USD, 6 meses). Todo recurso debe caber en ese presupuesto, con alertas de AWS Budgets activas. Al agotarse, se decide: pagar la cuenta, buscar financiación o deprecar. Nunca se cobra a médicos ni a pacientes.

## Identidad: login con código por WhatsApp (vía AWS)
El bot envía el código con una **plantilla de autenticación** de WhatsApp a través de **AWS End User Messaging Social** (Meta factura a AWS; AWS lo carga a la cuenta y se paga con créditos):

1. En la web, el médico escribe su número. El servidor lo normaliza a E.164, aplica los límites, crea un `login_challenge` (código de 6 dígitos guardado como hash, expira en 10 minutos, estado `pending`) y envía la plantilla de autenticación con `SendWhatsAppMessage`.
2. El médico escribe el código en la web (la plantilla lleva botón "copiar código").
3. Si coincide, el challenge pasa a `verified` y se crea la sesión (cookie httpOnly firmada con `jose`).

Seguridad y costo (cada envío cuesta dinero, así que los límites protegen también el presupuesto):
- Códigos de un solo uso, hash con pepper, comparación en tiempo constante; 5 códigos erróneos invalidan el challenge.
- Máximo 5 envíos por número por hora, límite por IP y **tope global de envíos por día** (`OTP_DAILY_CAP`).
- Números solo en E.164; solo se envía a prefijos permitidos (`OTP_ALLOWED_PREFIXES`, por defecto `+971`) para evitar la tarifa internacional y el fraude de bombeo de mensajes.

Fallback: correo con magic link solo para quien no pueda usar WhatsApp.

El bot **solo inicia conversación para enviar el código de login**. Nada de marketing. Nunca usar librerías no oficiales de WhatsApp (Baileys, whatsapp-web.js, etc.).

## Confirmación periódica
- **Cada 3 meses:** el admin pega en el grupo de WhatsApp un mensaje con `wa.me/<BOT_NUMBER>?text=CONFIRMAR`. El bot identifica al médico por su número, le muestra sus datos y ofrece: 1 = siguen igual, 2 = recibir enlace para editar. Son respuestas de servicio: 1.000 gratis al mes por número desde el 1 de octubre de 2026; a partir de ahí, tarifa de utilidad de EAU.
- **A las 2 semanas:** el panel de admin exporta la lista de quienes no confirmaron. Se les recuerda con una lista de difusión desde un WhatsApp normal (app personal, no Business; máx. 256 contactos por lista; el médico debe tener guardado el número del directorio, que recibe como contacto al darse de alta).
- **A los 90 días sin confirmar:** estado `stale` ("pendiente"). **A los 180:** oculto.
- **Reportes comunitarios:** botón "Ya no está aquí". Con 2 reportes de usuarios distintos, el perfil pasa a `stale` hasta que el médico confirme.

## Stack
- Next.js (App Router, TypeScript 5.9), salida `standalone`. **Sin Tailwind.**
- UI con el sistema de diseño Primer: `@primer/react` (componentes), `@primer/primitives` (tokens CSS y temas claro/oscuro automáticos vía `data-color-mode="auto"` en `<html>`) y `@primer/octicons-react` (íconos). Sin logos, nombre ni marca de GitHub. Estilos con variables de Primer (`var(--fgColor-muted)`, `var(--base-size-16)`…), nunca valores sueltos.
- Server Components por defecto; los componentes de Primer que lo necesiten van en componentes pequeños `"use client"`. Los componentes compuestos (`ActionMenu.Button`…) no se pueden usar con punto desde un Server Component: van en un componente cliente que recibe datos serializables.
- **AWS (una sola cuenta, plan gratuito con créditos).** App y base de datos en **`eu-north-1` (Estocolmo)**: `me-central-1` (EAU) no ofrece instancias EC2 del free tier. WhatsApp en `me-central-1`. Sin dominio propio.
  - **CloudFront** (capa gratuita permanente): URL pública `https://duk8oc8ifzaf.cloudfront.net`, HTTPS con certificado de AWS. Sin caché para páginas y API; caché para `/_next/static/*`.
  - **EC2** `t4g.small` (Graviton, prueba gratuita de 750 h/mes hasta el 31/12/2026), Ubuntu 24.04, IP elástica. Next.js `standalone` con Node 24 detrás de Caddy en el puerto 80. El security group solo acepta la lista de IPs de CloudFront y Caddy exige el encabezado `X-Origin-Verify` con `ORIGIN_SECRET`. El tramo CloudFront→EC2 va por HTTP (sin dominio no hay certificado para el origen). Acceso por SSM Session Manager, sin SSH. Rol de instancia IAM `dochis-ec2`: sin claves de acceso en el servidor.
  - **RDS PostgreSQL 17** `db.t4g.micro`, 20 GB, cifrado, SSL obligatorio, **no público**; solo acepta conexiones desde el security group de la EC2.
  - **SSM Parameter Store**: `/dochis/env` (SecureString) con todo el entorno de producción; `deploy/configure.sh` lo escribe en `/etc/dochis.env`.
  - **End User Messaging Social** (`me-central-1`): WhatsApp. Envío con `SendWhatsAppMessage`; los mensajes entrantes llegan a un tema **SNS** con suscripción HTTPS a `/api/whatsapp/sns` (se valida la firma de SNS).
  - **Lambda + EventBridge Scheduler**: tareas programadas (cron diario de frescura), fuera de la VPC; llaman a la app por HTTPS con `CRON_SECRET`. Ninguna Lambda se conecta a RDS (evita el NAT Gateway, ~32 USD/mes).
  - **Bedrock**: limpieza del Excel en la importación (script de un solo uso) y, opcionalmente, búsqueda en lenguaje natural. Siempre prescindible: si no está, la app sigue funcionando.
  - **AWS Budgets**: `dochis-gasto-real` (gasto fuera de créditos) y `dochis-creditos-mensual` (40 USD/mes, alertas al 50 %, 80 % y previsión 100 %).
- Acceso a datos con `postgres` (driver de Node) desde el servidor. **Dos roles de base de datos:** `web_reader` (solo `SELECT` sobre las vistas públicas; lo usan las páginas públicas) y `app_writer` (escrituras desde rutas de servidor). El usuario administrador de RDS nunca lo usa la app.
- Desarrollo local: PostgreSQL en Docker con las mismas migraciones y roles.
- Tests con Vitest (`npm test`); integración de permisos contra el Postgres local.
- Sesiones propias: cookie httpOnly firmada con `jose`.
- Resend solo para el fallback de correo.

## Modelo de datos
- `doctors`: id, slug (único, para `/medico/[slug]`), full_name, specialty, clinic, area, emirate, languages text[], insurances text[], regulator (DHA|DOH|MOHAP), license_number, phone_e164 (único, login), public_whatsapp (nullable, solo con consentimiento), email (nullable), status (unclaimed|pending_verification|verified|stale|hidden), consent_at, last_confirmed_at, created_at
- `confirmations`: id, doctor_id, confirmed_at (historial para el gráfico de confirmaciones; se agrega una fila cada vez que el médico confirma)
- `login_challenges`: id, phone_e164, code_hash, status (pending|verified|expired), attempts, expires_at, verified_at, created_at, ip
- `bot_sessions`: phone_e164, state (idle|awaiting_confirm_choice), updated_at (estado de la conversación del bot)
- `reports`: id, doctor_id, reporter_fingerprint, reason, created_at
- `verification_requests`: id, doctor_id, license_number, regulator, status, reviewed_by, created_at
- `admins`: phone_e164, role (admin|ambassador), scope (nacionalidad o especialidad, nullable)

## Roles
- **Público:** lee las vistas `public_doctors` y `public_confirmations` a través del rol `web_reader`: perfiles verified/stale (sin phone_e164, email ni licencia) y unclaimed mostrando solo nombre, especialidad, clínica, zona y emirato (el resto vacío). Nunca pending_verification ni hidden. `web_reader` no tiene permiso sobre ninguna tabla.
- **Médico:** edita solo su perfil.
- **Embajador:** aprueba altas y licencias dentro de su ámbito (por nacionalidad o especialidad).
- **Admin:** todo, incluida la exportación de no confirmados.

## Idioma
Interfaz en español neutro. Mensajes del bot en español, breves. Código en inglés.

## Referencia visual
`prototype.html` es el prototipo aprobado para **flujos, contenido y textos** (búsqueda, filtros, orden aleatorio, estado de frescura, login por WhatsApp, reportes y alta). **No copiar su estilo visual**: la interfaz sigue el estilo de GitHub con Primer. El prototipo muestra el "OTP inverso" (el médico envía el código); fue reemplazado por el código que envía el bot.

## Diseño (traducción de GitHub al directorio)
- Home = página "Explore": búsqueda arriba, filtros como menús desplegables (ActionMenu/SelectPanel) y resultados como lista de repositorios (filas con separadores, no tarjetas).
- Filtros: especialidad, emirato, seguro **e idioma** (principio 7). Viven en la URL (`?q=&esp=&emirato=&seguro=&idioma=`) para render en servidor y enlaces compartibles.
- Especialidad, idiomas y seguros = Labels tipo "topics".
- Estado = Label: verde "Confirmado", amarillo "Pendiente", gris "Sin confirmar"; Octicon de verificado junto al regulador.
- Estado efectivo: un perfil `verified` con más de 90 días sin confirmar se muestra como "Pendiente" aunque el cron aún no lo haya cambiado.
- `/medico/[slug]`: layout de perfil de usuario (izquierda avatar de iniciales, datos y "Escribir por WhatsApp"; derecha detalles, seguros y gráfico de confirmaciones, una celda por mes).
- `/admin`: como Issues/PRs, pestañas "Pendientes de verificar" / "Sin confirmar esta ronda" / "Reportes".
- Login por WhatsApp: flujo de pasos estilo pantalla de sign-in (número → código → listo).
- Mobile first.

## Registro de decisiones
- **2026-09-21:** Tailwind reemplazado por Primer (estilo GitHub, sin marca).
- **2026-09-21:** Se agregan `confirmations` y `slug`; `public_doctors` incluye unclaimed con datos mínimos; filtro por idioma.
- **2026-09-21:** Infraestructura en AWS con créditos del plan gratuito (EC2 + RDS + End User Messaging Social + Lambda + Bedrock + Route 53 + Budgets) en lugar de Vercel + Supabase. Se acepta el horizonte de 6 meses.
- **2026-09-21:** El login pasa de "OTP inverso" (el médico escribe al bot) a código enviado por el bot con plantilla de autenticación. Costo aproximado en EAU: ~0,016 USD de Meta + 0,005 USD de AWS por login.
- **2026-09-21:** Licencia GPL-3.0 (elegida al crear el repo) en lugar de MIT.
- **2026-09-21:** App y RDS en `eu-north-1` (EAU no tiene EC2 del free tier); WhatsApp en `me-central-1`.
- **2026-09-21:** Sin dominio propio (costo). URL de CloudFront; `sslip.io` descartado porque su cuota de Let's Encrypt se agota.
- **Descartado:** SMS (en EAU exige registrar un sender ID ante TDRA con licencia comercial, y ese registro está pausado en AWS a la espera de nuevos requisitos de TDRA; las rutas sin registrar se bloquean).
