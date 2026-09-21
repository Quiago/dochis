# Directorio de médicos hispanohablantes en Emiratos

## Qué es
Directorio web gratuito y comunitario de médicos que atienden en español en los Emiratos Árabes Unidos. Nace de un grupo de WhatsApp de unos 350 sanitarios hispanos cuya lista en Google Sheets se mantenía a mano y estaba desactualizada.

## Problema que resuelve
- La lista la mantienen voluntarios a mano y ya no dan abasto.
- Los directorios oficiales filtran por nacionalidad, no por idioma, y están separados por regulador (DHA en Dubái, DOH en Abu Dabi, MOHAP en el resto).
- Siempre se recomiendan los mismos médicos.
- El correo no funciona para recordatorios: los médicos no lo leen. Viven en WhatsApp.

## Principios de producto (no romper)
1. **Pro-bono, siempre.** Gratis para médicos y pacientes. Sin anuncios, sin perfiles destacados pagados, sin venta de datos. La comunidad rechazó un intento anterior de app de pago; cualquier señal de negocio mata el proyecto. Código abierto.
2. **Cada médico es dueño de su perfil.** Ningún voluntario mantiene datos a mano.
3. **Cero trabajo extra para los médicos.** Confirmar datos = tocar un enlace y enviar un mensaje de WhatsApp.
4. **Justicia en la visibilidad.** Orden aleatorio por defecto. Nada de rankings por popularidad.
5. **Frescura visible.** Cada perfil muestra cuándo se confirmó. Sin confirmación en 90 días pasa a "pendiente".
6. **Privacidad primero (PDPL de EAU).** El teléfono de login no se publica salvo consentimiento explícito para usarlo como contacto. Perfiles importados del Excel muestran solo nombre, especialidad y centro hasta que el médico los reclame.
7. **Filtrar por idioma, no por nacionalidad.**
8. **Costo operativo cero.** Toda decisión técnica debe caber en planes gratuitos.

## Identidad: login por WhatsApp con "OTP inverso" (gratis)
No se envían SMS ni plantillas de WhatsApp (ambos se cobran). En su lugar, **el médico le escribe al bot**, y los mensajes entrantes a la Cloud API de Meta son gratis:

1. En la web, el médico escribe su número. El servidor crea un `login_challenge` con un código de 6 dígitos, expiración de 10 minutos y estado `pending`.
2. La web muestra un botón `https://wa.me/<BOT_NUMBER>?text=CODIGO%20123456` (en escritorio, también un QR del mismo enlace).
3. El médico envía el mensaje prellenado. El webhook de la Cloud API recibe el mensaje con el número del remitente (`from`), que WhatsApp garantiza.
4. Si el código coincide y `from` coincide con el número ingresado, el challenge pasa a `verified`. El bot responde "Listo, ya puedes volver a la web" (mensaje de servicio, dentro del cupo gratuito de 1.000 al mes).
5. La web consulta el estado del challenge (polling cada 2 s o Supabase Realtime) y, al verificarse, crea la sesión.

Seguridad: códigos de un solo uso, límite de 5 intentos por número por hora, verificar la firma `X-Hub-Signature-256` del webhook con el App Secret, normalizar números a E.164.

Fallback: correo con magic link solo para quien no pueda usar WhatsApp.

## Confirmación periódica (gratis)
- **Cada 3 meses:** el admin pega en el grupo de WhatsApp un mensaje con `wa.me/<BOT_NUMBER>?text=CONFIRMAR`. El bot identifica al médico por su número, le muestra sus datos y ofrece: 1 = siguen igual, 2 = recibir enlace para editar.
- **A las 2 semanas:** el panel de admin exporta la lista de quienes no confirmaron. Se les recuerda con una lista de difusión desde un WhatsApp normal (app personal, no Business; máx. 256 contactos por lista; el médico debe tener guardado el número del directorio, que recibe como contacto al darse de alta).
- **A los 90 días sin confirmar:** estado `stale` ("pendiente"). **A los 180:** oculto.
- **Reportes comunitarios:** botón "Ya no está aquí". Con 2 reportes de usuarios distintos, el perfil pasa a `stale` hasta que el médico confirme.

Nunca enviar mensajes iniciados por el bot (plantillas) ni usar librerías no oficiales de WhatsApp (Baileys, whatsapp-web.js, etc.).

## Stack
- Next.js (App Router, TypeScript 5.9). **Sin Tailwind.**
- UI con el sistema de diseño Primer: `@primer/react` (componentes), `@primer/primitives` (tokens CSS y temas claro/oscuro automáticos vía `data-color-mode="auto"` en `<html>`) y `@primer/octicons-react` (íconos). Sin logos, nombre ni marca de GitHub. Estilos con variables de Primer (`var(--fgColor-muted)`, `var(--base-size-16)`…), nunca valores sueltos.
- Server Components por defecto; los componentes de Primer que lo necesiten van en componentes pequeños `"use client"`.
- Clientes Supabase: `lib/supabase.ts` (anon, importable en cualquier lado) y `lib/supabase-server.ts` (service role, protegido con `server-only`).
- Tests con Vitest (`npm test`); integración RLS contra Supabase local (`npx supabase start`, requiere Docker).
- Supabase: Postgres + RLS (lecturas públicas); escrituras vía rutas de servidor con service role
- Sesiones propias: cookie httpOnly firmada con `jose` tras verificar el challenge
- WhatsApp Cloud API de Meta directa (sin Twilio ni otros intermediarios): solo webhook entrante y respuestas de servicio
- Vercel para hosting; Vercel Cron para cambiar estados por antigüedad
- Resend solo para el fallback de correo

## Modelo de datos
- `doctors`: id, slug (único, para `/medico/[slug]`), full_name, specialty, clinic, area, emirate, languages text[], insurances text[], regulator (DHA|DOH|MOHAP), license_number, phone_e164 (único, login), public_whatsapp (nullable, solo con consentimiento), email (nullable), status (unclaimed|pending_verification|verified|stale|hidden), consent_at, last_confirmed_at, created_at
- `confirmations`: id, doctor_id, confirmed_at (historial para el gráfico de confirmaciones; se agrega una fila cada vez que el médico confirma)
- `login_challenges`: id, phone_e164, code_hash, status (pending|verified|expired), attempts, expires_at, verified_at
- `bot_sessions`: phone_e164, state (idle|awaiting_confirm_choice), updated_at (estado de la conversación del bot)
- `reports`: id, doctor_id, reporter_fingerprint, reason, created_at
- `verification_requests`: id, doctor_id, license_number, regulator, status, reviewed_by, created_at
- `admins`: phone_e164, role (admin|ambassador), scope (nacionalidad o especialidad, nullable)

## Roles
- **Público:** lee la vista `public_doctors`: perfiles verified/stale (sin phone_e164, email ni licencia) y unclaimed mostrando solo nombre, especialidad, clínica, zona y emirato (el resto en null). Nunca pending_verification ni hidden. Es lo único que `anon` puede leer.
- **Médico:** edita solo su perfil.
- **Embajador:** aprueba altas y licencias dentro de su ámbito (por nacionalidad o especialidad).
- **Admin:** todo, incluida la exportación de no confirmados.

## Idioma
Interfaz en español neutro. Mensajes del bot en español, breves. Código en inglés.

## Referencia visual
`prototype.html` es el prototipo aprobado para **flujos, contenido y textos** (búsqueda, filtros, orden aleatorio, estado de frescura, login por WhatsApp con QR, reportes y alta). **No copiar su estilo visual**: la interfaz sigue el estilo de GitHub con Primer.

## Diseño (traducción de GitHub al directorio)
- Home = página "Explore": búsqueda arriba, filtros como menús desplegables (ActionMenu/SelectPanel) y resultados como lista de repositorios (filas con separadores, no tarjetas).
- Filtros: especialidad, emirato, seguro **e idioma** (principio 7). Viven en la URL (`?q=&esp=&emirato=&seguro=&idioma=`) para render en servidor y enlaces compartibles.
- Especialidad, idiomas y seguros = Labels tipo "topics".
- Estado = Label: verde "Confirmado", amarillo "Pendiente", gris "Sin confirmar"; Octicon de verificado junto al regulador.
- Estado efectivo: un perfil `verified` con más de 90 días sin confirmar se muestra como "Pendiente" aunque el cron aún no lo haya cambiado.
- `/medico/[slug]`: layout de perfil de usuario (izquierda avatar de iniciales, datos y "Escribir por WhatsApp"; derecha detalles, seguros y gráfico de confirmaciones, una celda por mes).
- `/admin`: como Issues/PRs, pestañas "Pendientes de verificar" / "Sin confirmar esta ronda" / "Reportes".
- Login por WhatsApp: flujo de pasos estilo pantalla de sign-in.
- Mobile first.
