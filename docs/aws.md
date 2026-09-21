# Infraestructura en AWS

Guía paso a paso para montar el directorio en una cuenta de AWS con el plan gratuito (créditos). Todo se hace desde la consola; no hace falta instalar nada en tu computadora.

**Reglas para no gastar créditos de más:** nunca crear NAT Gateway, Multi-AZ, Secrets Manager ni balanceadores de carga. Una sola EC2 y una sola RDS.

## 0. Presupuesto (primero de todo)
Billing and Cost Management → Budgets → Create budget:
1. **Plantilla "Zero spend budget"**: avisa en cuanto haya gasto real (fuera de créditos).
2. **Presupuesto de costo mensual de 40 USD** con alertas al 50 % y 80 %, **incluyendo créditos** en las opciones (así se ve cuánto crédito se consume).

## 1. Región
Todo va en **Middle East (UAE) `me-central-1`** (activada en Account → AWS Regions). End User Messaging Social está disponible ahí.

## 2. Rol IAM de la EC2 (`dochis-ec2`)
IAM → Roles → Create role → AWS service → EC2:
- Política administrada: `AmazonSSMManagedInstanceCore` (acceso por navegador sin SSH).
- Política en línea `dochis-whatsapp` (se completa en la Fase 2, cuando exista el número del bot):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "social-messaging:SendWhatsAppMessage", "Resource": "*" }
  ]
}
```
Después de la Fase 2, cambia `"Resource": "*"` por el ARN del número del bot.

## 3. Security groups (VPC → Security groups, en la VPC por defecto)
| Nombre | Entrada |
|---|---|
| `dochis-web` | TCP 80 y 443 desde `0.0.0.0/0` y `::/0`. **Sin puerto 22.** |
| `dochis-db` | TCP 5432 **solo** desde el security group `dochis-web`. |

## 4. EC2 (actividad "Launch an instance")
EC2 → Launch instance:
- Nombre `dochis-web`, AMI **Ubuntu Server 24.04 LTS (64-bit Arm)**, tipo **t4g.small**.
- Key pair: **Proceed without a key pair** (entramos con Session Manager).
- Red: VPC por defecto, security group `dochis-web`.
- Disco: 20 GB gp3.
- Advanced details → IAM instance profile: `dochis-ec2`.

Luego EC2 → Elastic IPs → Allocate → Associate a la instancia. Anota la IP.

## 5. RDS PostgreSQL (actividad "Create an RDS database")
RDS → Create database:
- Standard create, **PostgreSQL 17**, plantilla **Free tier**.
- Identificador `dochis-db`, usuario maestro `postgres`, **contraseña autogestionada** (no Secrets Manager). Genera una con `openssl rand -hex 24`.
- Clase **db.t4g.micro**, 20 GB gp3, sin autoescalado de almacenamiento, **Single-AZ**.
- Conectividad: **no conectar** a EC2 automáticamente, **Public access: No**, security group `dochis-db` (quita el `default`).
- Additional configuration: nombre de base inicial `dochis`, backups 1 día, cifrado activado, sin Performance Insights ni Enhanced Monitoring.

Anota el **endpoint** (algo como `dochis-db.xxxx.me-central-1.rds.amazonaws.com`).

## 6. Preparar el servidor
EC2 → la instancia → Connect → **Session Manager** → Connect. En la terminal del navegador:

```bash
sudo -i
# Swap de 2 GB (la compilación de Next.js necesita memoria)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Node 24, git, cliente de Postgres
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs git postgresql-client

# Caddy (HTTPS automático)
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

# Usuario y código
useradd --system --create-home --shell /bin/bash dochis
git clone https://github.com/<tu-usuario>/<tu-repo>.git /opt/dochis
chown -R dochis:dochis /opt/dochis
echo 'dochis ALL=(root) NOPASSWD: /usr/bin/systemctl restart dochis' > /etc/sudoers.d/dochis
```

Crea `/etc/dochis.env` (copia `.env.example` y rellena). Las contraseñas de `web_reader` y `app_writer` las eliges tú (`openssl rand -hex 24`); el script de migración las aplica:

```bash
cp /opt/dochis/.env.example /etc/dochis.env
nano /etc/dochis.env
chown root:dochis /etc/dochis.env && chmod 640 /etc/dochis.env
```

```ini
DATABASE_URL=postgres://app_writer:<pass-writer>@<endpoint>:5432/dochis?sslmode=require
DATABASE_READER_URL=postgres://web_reader:<pass-reader>@<endpoint>:5432/dochis?sslmode=require
DATABASE_ADMIN_URL=postgres://postgres:<pass-maestro>@<endpoint>:5432/dochis?sslmode=require
NEXT_PUBLIC_SITE_URL=https://<tu-dominio>
AWS_REGION=me-central-1
```

Instala el servicio, Caddy y haz el primer deploy:

```bash
cp /opt/dochis/deploy/dochis.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable dochis
sed 's/medicos.example.com/<tu-dominio>/' /opt/dochis/deploy/Caddyfile > /etc/caddy/Caddyfile && systemctl reload caddy
sudo -u dochis /opt/dochis/scripts/deploy.sh
```

No cargues `db/seed.sql` en producción: son médicos ficticios. El directorio arranca vacío hasta la importación de la Fase 5.

## 7. Dominio (Route 53)
- Registra el dominio en Route 53 → Registered domains (el registro **no** se paga con créditos) o en otro registrador.
- Route 53 → Hosted zones → la zona del dominio → registro **A** con la Elastic IP. Si el dominio está en otro registrador, apunta sus nameservers a los de la zona.
- Cuando el DNS resuelva, Caddy emite el certificado solo. Comprueba `https://<tu-dominio>`.

## 8. Comprobar la seguridad en RDS
Desde la EC2 (Session Manager):

```bash
set -a; . /etc/dochis.env; set +a
psql "$DATABASE_READER_URL" -c 'select phone_e164 from doctors'          # debe fallar: permission denied
psql "$DATABASE_READER_URL" -c 'select phone_e164 from public_doctors'   # debe fallar: column does not exist
psql "$DATABASE_READER_URL" -c 'select count(*) from public_doctors'     # funciona
```

## Actualizar la app
Session Manager → `sudo -u dochis /opt/dochis/scripts/deploy.sh`.

## Pendiente de otras fases
- **Fase 2:** End User Messaging Social (número del bot, plantilla de autenticación, tema SNS con suscripción HTTPS a `/api/whatsapp/sns`).
- **Fase 4:** Lambda + EventBridge Scheduler para el cron diario.
