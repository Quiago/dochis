# Roadmap: de prototipo a producción

Proyecto comunitario, gratuito y de código abierto. Cada fase termina con algo desplegado. Los prompts están pensados para Claude Code con `CLAUDE.md` y `prototype.html` en la raíz del repo.

**Presupuesto:** créditos del plan gratuito de AWS (100 USD al registrarse + 100 USD por 5 actividades), válidos 6 meses. Aparte solo se paga la SIM del bot. Sin dominio propio: la URL es la de CloudFront.

### Actividades de AWS (20 USD cada una) y dónde se cumplen
| Actividad | Se cumple en |
|---|---|
| Set up a cost budget using AWS Budgets | ✅ Fase 0b |
| Create an Aurora or RDS database | ✅ Fase 0b |
| Launch an instance using EC2 | Fase 0b (requiere lanzar y terminar una instancia: se hizo con una t4g.micro desechable) |
| Create a web app using AWS Lambda | ✅ Fase 4 (cron de frescura) |
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
PostgreSQL con roles `web_reader`/`app_writer`, Docker para desarrollo, EC2 + RDS en `eu-north-1`, CloudFront sin dominio, entorno en SSM, scripts de arranque y despliegue. Detalle en `docs/aws.md`. En producción: `https://dochis.pages.dev`.

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
6. WhatsApp → Configuration → Webhook: URL `https://dochis.pages.dev/api/whatsapp/webhook`, el verify token, y suscribirte al campo **messages**.
7. Para producción: token permanente de un **System User** y el número real del bot (SIM de EAU no registrada en la app de WhatsApp).

---

## Fase 3: Reclamar perfil, alta y embajadores ✅ (hecho)
- `/cuenta`: si el teléfono o correo de la sesión coincide con un médico, edita su perfil (sin cambiar la licencia = confirmación); si viene de "¿Eres tú?", reclamo (el perfil no cambia hasta aprobarse); si no, alta (privada hasta verificarse).
- `/cuenta/listo` con el contacto del directorio (`/contacto.vcf`).
- `/admin` estilo Issues: solicitudes con enlace al registro oficial, Aprobar/Rechazar; embajadores limitados a su especialidad.
- Alta de admins/embajadores: `node scripts/add-admin.ts <teléfono-o-correo> [admin|ambassador] [especialidad]`.
- Sin foto ni redes sociales (ver decisiones en CLAUDE.md).

---

## Fase 4: Frescura automática y reportes ✅ (hecho, salvo los comandos del bot)
- Cron diario: Lambda `dochis-cron` (fuera de la VPC, Function URL con IAM) + EventBridge Scheduler `dochis-freshness` a las 03:00 de Dubái → `POST /api/cron/freshness` con `CRON_SECRET`. Pendiente a los 35 días, oculto a los 90 (confirmación mensual).
- "Ya no está aquí" en filas y perfil: 2 personas distintas en 30 días → pendiente; huella anónima; 10 reportes/día por persona.
- `/admin`: "Sin confirmar este mes" (desde el día 1 del mes, con botones para copiar teléfonos y correos) y "Reportes" (descartar).
- Mientras WhatsApp no esté activo, confirmar = entrar y pulsar "Guardar perfil".
- **Pendiente hasta tener WhatsApp:** comandos CONFIRMAR / 1 / 2 del bot con `bot_sessions` y enlace de edición de un solo uso.

---

## Fase 4.5: Portada estilo dashboard de GitHub ✅ (hecho)
La portada vendía "Entrar con WhatsApp" aunque WhatsApp no está activo, y los textos decían "confirma por WhatsApp". Se rediseña como el feed principal de GitHub:
- **Cabecera** con menú lateral (hamburguesa): Directorio, Sobre el proyecto, Privacidad, Mi cuenta o Entrar, Panel de revisión (solo revisores).
- **Columna izquierda** (como "Top repositories"): especialidades y emiratos con su número de médicos, en orden alfabético (nada de rankings, principio 4). Enlazan al filtro.
- **Centro**: buscador grande, filtros y la lista de médicos.
- **Columna derecha** (como el changelog): tarjeta "¿Eres médico?" con el botón del canal que esté activo (correo o WhatsApp), "Cómo funciona" en 3 pasos y cifras del directorio. Sin "recién confirmados": daría más visibilidad a unos que a otros.
- **Textos sin canal fijo**: "Confirmado hace N días", "confirma sus datos una vez al mes".
- Páginas **Sobre el proyecto** y **Privacidad** (se adelantan de la Fase 5 porque el menú las enlaza).
- Móvil: las columnas laterales pasan al menú y debajo de la lista.

---

## Fase 5: Importar la lista y lanzar (en curso)
- `node --env-file=.env.local scripts/import-csv.ts "<archivo.csv>" [--dry-run]` → perfiles `unclaimed` (público: nombre, especialidad y centro) + informe en `data/import-report.md`. Idempotente.
- Normalización con reglas deterministas y revisables (`lib/import.ts`): 97 variantes de especialidad → 46; emiratos con erratas; webs quitadas del centro.
- Teléfono de acceso: **solo móviles de EAU** (las centralitas y fijos no se guardan, y cada número tiene un solo dueño). Correo: privado, sirve para reclamar el perfil entrando con él.
- Se omiten filas fuera de EAU, sin emirato y nombres repetidos (quedan listadas en el informe para arreglarlas a mano).
- El CSV y el informe tienen datos reales: están en `.gitignore` y nunca se suben al repo.
- Páginas "Sobre el proyecto" y "Privacidad": hechas en la Fase 4.5.

**Tú haces:**
- Revisar `data/import-report.md` y confirmar la importación en producción.
- **Bedrock (+20 USD de créditos):** consola de AWS → Amazon Bedrock → Playgrounds → Chat → elige un modelo (p. ej. Amazon Nova Micro) y pídele algo (por ejemplo, revisar la tabla de especialidades del informe). Con enviar un mensaje basta.
- Enseñarle el sitio al admin del grupo y que lo anuncie él.

**Lanzamiento:** mensaje del admin en el grupo con el enlace a `https://dochis.pages.dev`.

---

## Fase 6 (opcional): Búsqueda en lenguaje natural
> Interpreta búsquedas como "pediatra en Marina que acepte Daman" con Bedrock y conviértelas en filtros. Si Bedrock falla o no está configurado, usa la búsqueda normal.

---

## Rutina de mantenimiento (10 minutos al mes)
1. El día 1, el admin pega el mensaje de confirmación mensual en el grupo.
2. Hacia el día 15, copia desde `/admin` los que no confirmaron y les envía la lista de difusión.
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
