#!/usr/bin/env bash
# Se ejecuta en la EC2 como el usuario dochis: actualiza, compila, migra y reinicia.
set -euo pipefail
cd /opt/dochis
git pull --ff-only
npm ci
npm run build
cp -r .next/static .next/standalone/.next/
[ -d public ] && cp -r public .next/standalone/
node --env-file=/etc/dochis.env scripts/migrate.ts
sudo systemctl restart dochis
echo "Desplegado $(git rev-parse --short HEAD)"
