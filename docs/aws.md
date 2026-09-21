# Infraestructura en AWS

Cuenta de AWS con el plan gratuito (créditos). App y base de datos en **`eu-north-1` (Estocolmo)**. WhatsApp va por la Cloud API de Meta, fuera de AWS.

**Reglas para no gastar créditos de más:** nunca crear NAT Gateway, Multi-AZ, Secrets Manager ni balanceadores de carga. Una sola EC2 y una sola RDS.

## Qué hay creado
| Recurso | Nombre / ID | Notas |
|---|---|---|
| URL pública | `https://duk8oc8ifzaf.cloudfront.net` | CloudFront `E1URVJLM27QM6N`, PriceClass_200 (incluye Oriente Medio) |
| EC2 | `dochis-web` · `i-0dd6e50debd886ccb` · t4g.small | Ubuntu 24.04 arm64, IP elástica `13.50.144.172` |
| RDS | `dochis-db` · db.t4g.micro · PostgreSQL 17 | No pública, cifrada, backups 1 día, SSL obligatorio |
| Security groups | `dochis-web` (80 solo desde CloudFront) · `dochis-db` (5432 solo desde `dochis-web`) | Sin puerto 22 |
| IAM | rol e instance profile `dochis-ec2` | `AmazonSSMManagedInstanceCore` + `dochis-whatsapp` |
| Entorno | SSM Parameter Store `/dochis/env` (SecureString) | Todas las variables de producción |
| Budgets | `dochis-gasto-real`, `dochis-creditos-mensual` | Alertas por correo |
| Lambda | `dochis-cron` (código en `deploy/lambda/cron.mjs`) | Rol `dochis-cron-lambda`; Function URL con `AWS_IAM` |
| Scheduler | `dochis-freshness`, `cron(0 3 * * ? *)` Asia/Dubai | Rol `dochis-scheduler` (solo invoca `dochis-cron`) |

Los secretos generados (contraseñas de RDS y de los roles, `OTP_PEPPER`, `SESSION_SECRET`, `CRON_SECRET`, `ORIGIN_SECRET`) están en `/dochis/env` y, en la máquina de quien montó la infraestructura, en `~/.config/dochis/secrets.env` (permisos 600, fuera del repo).

## Cómo encaja
```
Navegador ──HTTPS──▶ CloudFront ──HTTP + X-Origin-Verify──▶ EC2 :80 Caddy ──▶ Next.js :3000 ──SSL──▶ RDS
```
- El security group de la EC2 solo acepta la lista administrada `com.amazonaws.global.cloudfront.origin-facing`.
- Caddy responde 403 a toda petición sin el encabezado `X-Origin-Verify` igual a `ORIGIN_SECRET`.
- `ponytail:` el tramo CloudFront→EC2 no va cifrado porque no hay dominio. Con un dominio: registro A a la IP elástica, `deploy/Caddyfile` con `<dominio> { reverse_proxy 127.0.0.1:3000 }` y origen HTTPS en CloudFront.

## Scripts del servidor (en el repo)
| Script | Cuándo | Qué hace |
|---|---|---|
| `deploy/bootstrap.sh` | User data de la EC2, una vez | Swap, Node 24, Caddy, AWS CLI, usuario `dochis`, clona el repo, instala `dochis.service` |
| `deploy/configure.sh` | Como root, tras el arranque o si cambia `/dochis/env` | Escribe `/etc/dochis.env` desde SSM, configura Caddy (sin `--environ`, para no volcar secretos al journal) |
| `scripts/deploy.sh` | Como `dochis`, en cada versión | `git pull`, `npm ci`, build con el entorno de producción, migraciones, reinicio |

## Operación diaria
Entrar al servidor: consola → EC2 → `dochis-web` → Connect → **Session Manager**.

Desplegar la última versión de `main`:
```bash
sudo -u dochis HOME=/home/dochis bash /opt/dochis/scripts/deploy.sh
```

Cambiar una variable de entorno:
```bash
# en tu máquina (AWS CLI con sesión)
aws ssm get-parameter --region eu-north-1 --name /dochis/env --with-decryption --query Parameter.Value --output text > /tmp/env
nano /tmp/env
aws ssm put-parameter --region eu-north-1 --name /dochis/env --type SecureString --overwrite --value file:///tmp/env && rm /tmp/env
# en el servidor
sudo REGION=eu-north-1 bash /opt/dochis/deploy/configure.sh && sudo -u dochis HOME=/home/dochis bash /opt/dochis/scripts/deploy.sh
```
Si cambia una variable `NEXT_PUBLIC_*`, hace falta desplegar (se incrusta al compilar).

## Comprobar la seguridad en RDS
Desde la EC2:
```bash
set -a; . /etc/dochis.env; set +a
psql "$DATABASE_READER_URL" -c 'select phone_e164 from doctors'          # permission denied
psql "$DATABASE_READER_URL" -c 'select email from public_doctors'        # column does not exist
psql "$DATABASE_URL" -c 'create table hack(i int)'                       # permission denied for schema public
```

## Datos de prueba
No cargues `db/seed.sql` en producción: son médicos ficticios. El directorio arranca vacío hasta la importación de la Fase 5.

## Pendiente de otras fases
- **Fase 2:** WhatsApp va por la Cloud API de Meta (no AWS): cargar `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` y `NEXT_PUBLIC_BOT_NUMBER` en `/dochis/env` y desplegar. La política `dochis-whatsapp` del rol queda sin uso hasta que se use End User Messaging Social.

## Proxy gratis en Cloudflare Pages
`edge/functions/[[path]].js` reenvía todo a CloudFront. Una vez, con `npx wrangler login`:
```bash
cd edge
npx wrangler@4 pages project create medicos-en-espanol --production-branch main
npx wrangler@4 pages secret put PROXY_SECRET --project-name medicos-en-espanol   # mismo valor que en /dochis/env
npx wrangler@4 pages secret put ORIGIN --project-name medicos-en-espanol         # https://duk8oc8ifzaf.cloudfront.net
cd .. && npm run edge:deploy
```
Después, `NEXT_PUBLIC_SITE_URL=https://medicos-en-espanol.pages.dev` en `/dochis/env` y desplegar.
