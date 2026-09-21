#!/usr/bin/env bash
# Run as root after bootstrap and whenever the SSM parameter changes: fetches /etc/dochis.env and configures Caddy.
set -euo pipefail
REGION=${REGION:-eu-north-1}
umask 027
aws ssm get-parameter --region "$REGION" --name /dochis/env --with-decryption --query Parameter.Value --output text > /etc/dochis.env
chown root:dochis /etc/dochis.env && chmod 640 /etc/dochis.env
# Caddy reads ORIGIN_SECRET from the same file (systemd loads it as root).
mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=/etc/dochis.env\n' > /etc/systemd/system/caddy.service.d/dochis.conf
cp /opt/dochis/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload && systemctl restart caddy
echo "Configurado"
