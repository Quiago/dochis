#!/usr/bin/env bash
# Run as root after bootstrap and whenever the SSM parameter changes: fetches /etc/dochis.env and configures Caddy.
set -euo pipefail
REGION=${REGION:-eu-north-1}
export HOME=${HOME:-/root}  # SSM Run Command has no HOME; the snap aws CLI then prints nothing
umask 027
aws ssm get-parameter --region "$REGION" --name /dochis/env --with-decryption --query Parameter.Value --output text > /etc/dochis.env
[ -s /etc/dochis.env ] || { echo "No se pudo leer /dochis/env de SSM" >&2; exit 1; }
chown root:dochis /etc/dochis.env && chmod 640 /etc/dochis.env
# Caddy reads ORIGIN_SECRET from the same file (systemd loads it as root).
# The packaged unit runs `caddy run --environ`, which dumps every env var (secrets) to the journal: drop it.
mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=/etc/dochis.env\nExecStart=\nExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile\n' > /etc/systemd/system/caddy.service.d/dochis.conf
cp /opt/dochis/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload && systemctl restart caddy
echo "Configurado"
