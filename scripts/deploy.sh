#!/usr/bin/env bash
# Se ejecuta en la EC2 como el usuario dochis: actualiza, compila, migra y reinicia.
set -euo pipefail
cd /opt/dochis
git pull --ff-only
npm ci
# NEXT_PUBLIC_* are inlined at build time, so the build needs the production env.
set -a; . /etc/dochis.env; set +a
npm run build
cp -r .next/static .next/standalone/.next/
[ -d public ] && cp -r public .next/standalone/
node scripts/migrate.ts
sudo systemctl restart dochis
echo "Desplegado $(git rev-parse --short HEAD)"
