#!/usr/bin/env bash
# Runs on the EC2 as user dochis: update, build, migrate, then swap the running copy and restart.
# The service runs from /opt/dochis/run, so building never touches the files the live server is using.
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
rm -rf run.new && cp -a .next/standalone run.new
rm -rf run.old && { [ -d run ] && mv run run.old || true; } && mv run.new run
sudo systemctl restart dochis
rm -rf run.old
echo "Desplegado $(git rev-parse --short HEAD)"
