# Roadmap: de prototipo a producción

Proyecto comunitario, gratuito y de código abierto. Cada fase termina con algo desplegado. Los prompts están pensados para Claude Code con `CLAUDE.md` y `prototype.html` en la raíz del repo.

**Presupuesto:** créditos del plan gratuito de AWS (100 USD al registrarse + 100 USD por 5 actividades), válidos 6 meses. Aparte solo se paga la SIM del bot. Sin dominio propio: la URL es la de CloudFront.

### Actividades de AWS (20 USD cada una) y dónde se cumplen
| Actividad | Se cumple en |
|---|---|
| Set up a cost budget using AWS Budgets | ✅ Fase 0b |
| Create an Aurora or RDS database | ✅ Fase 0b |
| Launch an instance using EC2 | Fase 0b (requiere lanzar y terminar una instancia: se hizo con una t4g.micro desechable) |
| Create a web app using AWS Lambda | Fase 4 (cron de frescura) |
| Use a foundation model in the Amazon Bedrock playground | Fase 5 (probar el prompt de limpieza del Excel) |

### Costo mensual estimado (se descuenta de los créditos)
| Recurso | USD/mes |
|---|---|
| EC2 t4g.small (eu-north-1, 0,0172/h) | 0 hasta el 31/12/2026 (prueba gratuita), luego ~12,6 |
| Disco EBS 20 GB + IPv4 elástica | ~5,4 |
| RDS db.t4g.micro (0,016/h) + 20 GB | ~14 |
| CloudFront | 0 (capa gratuita permanente) |
| WhatsApp (logins a ~0,021 + respuestas del bot) | ~5 a 15 |
| Lambda, EventBridge, SNS, Bedrock | < 1 |
| **Total** | **~20 hasta diciembre, ~32 desde enero** (+ WhatsApp) → los 200 USD alcanzan para los 6 meses |

---

## Fase 0: Proyecto base ✅ (hecho)
Next.js + Primer, `.env.example`, tests con Vitest.

## Fase 0b: Infraestructura en AWS ✅ (hecho)
PostgreSQL con roles `web_reader`/`app_writer`, Docker para desarrollo, EC2 + RDS en `eu-north-1`, CloudFront sin dominio, entorno en SSM, scripts de arranque y despliegue. Detalle en `docs/aws.md`. En producción: `https://duk8oc8ifzaf.cloudfront.net`.

**Tú haces antes de la Fase 2:**
1. **Número del bot:** una SIM prepago de EAU que **no** esté registrada en la app de WhatsApp.
2. **End User Messaging Social** en `me-central-1`: conectar la cuenta de WhatsApp Business (el asistente abre el login de Meta), registrar el número del bot y crear un tema SNS como destino de eventos.
3. En WhatsApp Manager, crear la **plantilla de autenticación** en español (con botón "copiar código") y esperar su aprobación.

---

## Fase 1: Directorio de solo lectura ✅ (hecho; ya sobre PostgreSQL)
Búsqueda, filtros por especialidad, emirato, seguro e idioma, orden aleatorio, frescura, perfil `/medico/[slug]` con gráfico de confirmaciones, SEO en español.

---

## Fase 2: Login con código por WhatsApp (2 a 3 días)

**Prompt:**
> Implementa el login descrito en CLAUDE.md:
> 1. `POST /api/auth/challenge`: normaliza el número a E.164 con libphonenumber-js, rechaza prefijos fuera de `OTP_ALLOWED_PREFIXES`, aplica límites (5 por número por hora, por IP y `OTP_DAILY_CAP` global), crea el `login_challenge` con el código guardado como hash y envía la plantilla de autenticación con `SendWhatsAppMessage` (AWS SDK, credenciales del rol de la instancia).
> 2. `POST /api/auth/verify`: compara el código en tiempo constante, máximo 5 intentos, un solo uso; si es correcto crea la cookie de sesión httpOnly firmada con jose.
> 3. `POST /api/whatsapp/sns`: valida la firma del mensaje SNS, confirma la suscripción y procesa los mensajes entrantes. Deja preparado un router de comandos para CONFIRMAR, 1, 2 y AYUDA (respuestas de servicio).
> 4. En la web: pasos número → código → listo, estilo pantalla de sign-in, con reenvío tras 60 s.
> Escribe tests para la normalización, prefijos, expiración, intentos, límites y tope diario, y la validación de firma SNS.

**Tú haces:** suscribir el tema SNS a `https://<tu-dominio>/api/whatsapp/sns` y probar con tu número.

---

## Fase 3: Reclamar perfil, alta y embajadores (2 días)

**Prompt:**
> Después del login, si el número coincide con un médico existente, muestra su perfil para editar; si no, un formulario de alta. En ambos casos pide regulador y número de licencia, una casilla de consentimiento para publicar datos, y otra opcional para mostrar su WhatsApp como contacto. Crea `verification_request` y deja el perfil en `pending_verification`. Crea un panel `/admin` donde admins y embajadores (según su ámbito) ven solicitudes con enlace al buscador oficial del regulador y pueden aprobar o rechazar. El médico ve el estado la próxima vez que entra.
> Al terminar el alta, muestra un botón para descargar el contacto del directorio (.vcf) con el mensaje "Guárdalo para recibir los recordatorios".

---

## Fase 4: Frescura automática y reportes (1 a 2 días)

**Prompt:**
> Completa los comandos del bot: CONFIRMAR muestra los datos del médico según su número y pide 1 (siguen igual) o 2 (editar); 1 actualiza `last_confirmed_at` y agrega una fila en `confirmations`; 2 responde con un enlace de un solo uso que abre la edición con sesión iniciada. Usa `bot_sessions` para recordar el estado de la conversación.
> Crea `POST /api/cron/freshness` (protegido con `CRON_SECRET`) que pase a `stale` los perfiles con más de 90 días sin confirmar y a `hidden` los de más de 180. Crea una Lambda (fuera de la VPC) que lo llame, programada a diario con EventBridge Scheduler, y documenta su creación en `docs/aws.md`.
> Agrega el botón "Ya no está aquí" en cada fila; con 2 reportes distintos en 30 días el perfil pasa a `stale`.
> En `/admin`, una vista "Sin confirmar en esta ronda" con botón para copiar los números, para cargarlos en las listas de difusión.

---

## Fase 5: Importar la lista y lanzar (1 a 2 días)

**Tú haces primero:** enseñarle el sitio al admin del grupo, proponerle ser coadministrador y dejar claro que es gratuito y de código abierto. Que lo anuncie él.

**Prompt:**
> Crea un script de importación desde CSV que cree médicos `unclaimed` mostrando públicamente solo nombre, especialidad y centro, con la etiqueta "Perfil sin confirmar" y el botón para reclamarlo. Si el CSV trae teléfono, guárdalo en `phone_e164` sin publicarlo. Antes de insertar, normaliza especialidades, idiomas, seguros y emiratos con Bedrock (modelo pequeño) y genera un informe de cambios para revisar a mano; el script funciona también sin Bedrock.
> Crea las páginas de política de privacidad y "Sobre el proyecto" (comunitario, gratuito, código abierto, quién lo mantiene).

**Tú haces:** probar el prompt de limpieza en el playground de Bedrock (cumple la actividad) antes de correr el script.

**Lanzamiento:** mensaje del admin en el grupo con el enlace de CONFIRMAR, que sirve a la vez de invitación.

---

## Fase 6 (opcional): Búsqueda en lenguaje natural
> Interpreta búsquedas como "pediatra en Marina que acepte Daman" con Bedrock y conviértelas en filtros. Si Bedrock falla o no está configurado, usa la búsqueda normal.

---

## Rutina de mantenimiento (15 minutos cada 3 meses)
1. El admin pega el mensaje de confirmación trimestral en el grupo.
2. Dos semanas después, copia desde `/admin` los que no confirmaron y les envía la lista de difusión.
3. El cron hace el resto.
4. Revisar en AWS Budgets cuántos créditos quedan.

## Después del lanzamiento (solo si se usa)
1. Estadísticas privadas para cada médico: cuántas veces lo contactaron.
2. Abrir la plataforma a otras comunidades (portugués, francés, ruso) con el mismo código.
3. Referencias entre médicos.

## Límites a vigilar
- **Créditos de AWS:** 6 meses o hasta agotarse; entonces la cuenta del plan gratuito se cierra y hay 90 días para pasar al plan de pago antes de perder los datos. Decidir antes del mes 5.
- **WhatsApp:** cada login cuesta ~0,021 USD (plantilla de autenticación de Meta en EAU + 0,005 de AWS). Las respuestas del bot son gratis hasta 1.000 al mes por número desde el 1/10/2026. El tope diario de envíos protege el presupuesto.
- **EC2 t4g.small:** la prueba gratuita termina el 31/12/2026; a partir de ahí se descuenta de los créditos.
- **Nunca** crear un NAT Gateway ni instancias Multi-AZ: se comerían los créditos.
