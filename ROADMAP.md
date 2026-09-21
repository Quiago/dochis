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
| WhatsApp (Meta directo: entrantes gratis, 1.000 respuestas gratis al mes) | 0 |
| Lambda, EventBridge, Bedrock | < 1 |
| **Total** | **~20 hasta diciembre, ~32 desde enero** → los 200 USD alcanzan para los 6 meses |

---

## Fase 0: Proyecto base ✅ (hecho)
Next.js + Primer, `.env.example`, tests con Vitest.

## Fase 0b: Infraestructura en AWS ✅ (hecho)
PostgreSQL con roles `web_reader`/`app_writer`, Docker para desarrollo, EC2 + RDS en `eu-north-1`, CloudFront sin dominio, entorno en SSM, scripts de arranque y despliegue. Detalle en `docs/aws.md`. En producción: `https://duk8oc8ifzaf.cloudfront.net`.

**Tú haces antes de desplegar la Fase 2:** ver la Fase 2.

---

## Fase 1: Directorio de solo lectura ✅ (hecho; ya sobre PostgreSQL)
Búsqueda, filtros por especialidad, emirato, seguro e idioma, orden aleatorio, frescura, perfil `/medico/[slug]` con gráfico de confirmaciones, SEO en español.

---

## Fase 2: Login con "OTP inverso" por WhatsApp ✅ (código hecho)
`POST/GET /api/auth/challenge`, webhook `GET/POST /api/whatsapp/webhook` (verificación de Meta, firma, router de comandos AYUDA/CONFIRMAR/1/2), sesión con jose, pantallas `/entrar` y `/cuenta`. Tests de normalización, prefijos, expiración, intentos, límites, firma y deduplicación.

**Correo (activo ya):** código de 6 dígitos por SMTP. **Tú haces:** crear una cuenta de Gmail para el proyecto, activar la verificación en dos pasos y generar una **contraseña de aplicación** (myaccount.google.com → Seguridad → Contraseñas de aplicaciones). Con eso se arma `SMTP_URL=smtps://cuenta%40gmail.com:contraseña-de-aplicacion@smtp.gmail.com:465`.

**WhatsApp (cuando se pueda), Meta for Developers, gratis:**
1. developers.facebook.com → Create app → tipo **Business** → agregar el producto **WhatsApp**.
2. WhatsApp → API Setup: Meta te da un **número de prueba** y un token temporal. Agrega tu propio WhatsApp como destinatario de prueba (hasta 5).
3. Anota: **Phone number ID**, el número de prueba (sin "+") y, en App settings → Basic, el **App Secret**.
4. Inventa un **verify token** (cualquier texto largo).
5. Pásame esos valores (o cárgalos tú en `/dochis/env`, ver `docs/aws.md`) y despliego.
6. WhatsApp → Configuration → Webhook: URL `https://duk8oc8ifzaf.cloudfront.net/api/whatsapp/webhook`, el verify token, y suscribirte al campo **messages**.
7. Para producción: token permanente de un **System User** y el número real del bot (SIM de EAU no registrada en la app de WhatsApp).

---

## Fase 3: Reclamar perfil, alta y embajadores ✅ (hecho)
- `/cuenta`: si el teléfono o correo de la sesión coincide con un médico, edita su perfil (sin cambiar la licencia = confirmación); si viene de "¿Eres tú?", reclamo (el perfil no cambia hasta aprobarse); si no, alta (privada hasta verificarse).
- `/cuenta/listo` con el contacto del directorio (`/contacto.vcf`).
- `/admin` estilo Issues: solicitudes con enlace al registro oficial, Aprobar/Rechazar; embajadores limitados a su especialidad.
- Alta de admins/embajadores: `node scripts/add-admin.ts <teléfono-o-correo> [admin|ambassador] [especialidad]`.
- Sin foto ni redes sociales (ver decisiones en CLAUDE.md).

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
- **WhatsApp:** mensajes entrantes gratis; respuestas del bot gratis hasta 1.000 al mes por número desde el 1/10/2026, luego tarifa de utilidad de EAU. Meta exige un método de pago en la cuenta para seguir entregando respuestas de servicio.
- **EC2 t4g.small:** la prueba gratuita termina el 31/12/2026; a partir de ahí se descuenta de los créditos.
- **Nunca** crear un NAT Gateway ni instancias Multi-AZ: se comerían los créditos.
