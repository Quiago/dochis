# Roadmap: de prototipo a producción

Proyecto comunitario, gratuito y de código abierto. Cada fase termina con algo desplegado en Vercel. Los prompts están pensados para Claude Code con `CLAUDE.md` y `prototype.html` en la raíz del repo.

**Costo objetivo: 0 USD/mes.** Lo único que se paga es el dominio (unos 10 a 15 USD al año) y una SIM prepago para el número del bot.

---

## Fase 0: Preparación (1 día)

**Tú haces:**
- Cuentas gratis en GitHub, Vercel y Supabase. Repo público con licencia MIT.
- Una SIM prepago de EAU para el bot. Ese número **no puede estar registrado en la app de WhatsApp**.
- En Meta for Developers: crear una app tipo Business, agregar el producto WhatsApp, registrar el número del bot y generar un token permanente (System User). Guardar `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` y elegir un `WHATSAPP_VERIFY_TOKEN`.
- No hace falta crear plantillas: el bot nunca inicia conversaciones.

**Prompt:**
> Lee CLAUDE.md y prototype.html. Crea un proyecto Next.js con App Router, TypeScript y Tailwind. Configura Supabase (cliente público para lecturas y cliente de servidor con service role) y un `.env.example` con todas las variables de CLAUDE.md. Deja una página de inicio "En construcción".

**Tú haces:** conectar el repo a Vercel, cargar variables y verificar el deploy.

---

## Fase 1: Directorio de solo lectura (1 a 2 días)

**Prompt:**
> Crea las migraciones SQL de Supabase para todas las tablas de CLAUDE.md, la vista `public_doctors` y las políticas RLS (anon solo lee la vista). Agrega un seed con 12 médicos ficticios. Construye la página principal replicando prototype.html: búsqueda, filtros por especialidad, emirato y seguro, orden aleatorio por visita, estado de frescura, y botón "Contactar" con enlace wa.me al `public_whatsapp` solo si existe. Renderiza en servidor con metadatos SEO en español.

**Listo cuando:** un usuario anónimo no puede leer teléfono, correo ni licencia llamando directamente a la API de Supabase.

---

## Fase 2: Bot de WhatsApp y login con "OTP inverso" (2 a 3 días)

**Prompt:**
> Implementa el login por WhatsApp descrito en CLAUDE.md:
> 1. `POST /api/auth/challenge`: recibe el número, lo normaliza a E.164 con libphonenumber-js, aplica rate limit, crea un `login_challenge` con código de 6 dígitos (guardado como hash) y devuelve el id del challenge y el enlace wa.me.
> 2. `GET/POST /api/whatsapp/webhook`: verificación de Meta con `WHATSAPP_VERIFY_TOKEN` en GET; en POST valida `X-Hub-Signature-256`, lee `from` y el texto. Si el texto es `CODIGO <n>`, verifica el challenge pendiente de ese número y responde "Listo, ya puedes volver a la web". Deja preparado un router de comandos para CONFIRMAR, 1, 2 y AYUDA.
> 3. `GET /api/auth/challenge/:id`: devuelve el estado; al estar verificado, crea una cookie de sesión httpOnly firmada con jose.
> 4. En la web: pantalla de login con el número, botón "Abrir WhatsApp", QR del mismo enlace en escritorio (librería `qrcode`), estado de espera y redirección al terminar.
> Escribe tests para la normalización de números, la expiración y el rate limit.

**Tú haces:** en el panel de Meta, apuntar el webhook a `https://<tu-dominio>/api/whatsapp/webhook` y suscribirte al campo `messages`. Probar con tu propio número.

---

## Fase 3: Reclamar perfil, alta y embajadores (2 días)

**Prompt:**
> Después del login, si el número coincide con un médico existente, muestra su perfil para editar; si no, un formulario de alta. En ambos casos pide regulador y número de licencia, una casilla de consentimiento para publicar datos, y otra opcional para mostrar su WhatsApp como contacto. Crea `verification_request` y deja el perfil en `pending_verification`. Crea un panel `/admin` donde admins y embajadores (según su ámbito) ven solicitudes con enlace al buscador oficial del regulador y pueden aprobar o rechazar. Al aprobar, el bot no escribe (no puede iniciar); el médico ve el estado la próxima vez que entra.
> Al terminar el alta, muestra un botón para descargar el contacto del directorio (.vcf) con el mensaje "Guárdalo para recibir los recordatorios".

---

## Fase 4: Frescura automática y reportes (1 a 2 días)

**Prompt:**
> Completa los comandos del bot: CONFIRMAR muestra los datos del médico según su número y pide 1 (siguen igual) o 2 (editar); 1 actualiza `last_confirmed_at`; 2 responde con un enlace de un solo uso que abre la edición con sesión iniciada. Usa `bot_sessions` para recordar el estado de la conversación.
> Crea un cron diario en Vercel que pase a `stale` los perfiles con más de 90 días sin confirmar y a `hidden` los de más de 180.
> Agrega el botón "Ya no está aquí" en cada tarjeta; con 2 reportes distintos en 30 días el perfil pasa a `stale`.
> En `/admin`, una vista "Sin confirmar en esta ronda" con botón para copiar los números, para cargarlos en las listas de difusión.

---

## Fase 5: Importar la lista y lanzar (1 a 2 días)

**Tú haces primero:** enseñarle el sitio al admin del grupo, proponerle ser coadministrador y dejar claro que es gratuito y de código abierto. Que lo anuncie él.

**Prompt:**
> Crea un script de importación desde CSV que cree médicos `unclaimed` mostrando públicamente solo nombre, especialidad y centro, con la etiqueta "Perfil sin confirmar" y el botón para reclamarlo. Si el CSV trae teléfono, guárdalo en `phone_e164` sin publicarlo, para que el médico pueda reclamar su perfil al entrar con ese número.
> Crea las páginas de política de privacidad y "Sobre el proyecto" (comunitario, gratuito, código abierto, quién lo mantiene).

**Lanzamiento:** dominio propio en Vercel y un mensaje del admin en el grupo con el enlace de CONFIRMAR, que sirve a la vez de invitación.

---

## Rutina de mantenimiento (15 minutos cada 3 meses)
1. El admin pega el mensaje de confirmación trimestral en el grupo.
2. Dos semanas después, copia desde `/admin` los que no confirmaron y les envía la lista de difusión.
3. El cron hace el resto.

---

## Después del lanzamiento (solo si se usa)
1. Búsqueda en lenguaje natural ("pediatra en Marina que acepte Daman").
2. Estadísticas privadas para cada médico: cuántas veces lo contactaron.
3. Abrir la plataforma a otras comunidades (portugués, francés, ruso) con el mismo código.
4. Referencias entre médicos.

## Límites a vigilar
- Cupo de 1.000 mensajes de servicio gratis al mes por número (desde octubre de 2026). Con 350 médicos sobra; si se supera, se paga la tarifa de utilidad de EAU.
- Vercel Hobby es para uso no comercial, lo que encaja con un proyecto pro-bono.
- Plan gratuito de Supabase: el proyecto se pausa tras una semana sin actividad; el cron diario lo mantiene activo.
