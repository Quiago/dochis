# Médicos en español · Emiratos

Directorio gratuito, comunitario y de código abierto de médicos que atienden en español en los Emiratos Árabes Unidos. Ver [CLAUDE.md](CLAUDE.md) (fuente de verdad), [ROADMAP.md](ROADMAP.md) y [docs/aws.md](docs/aws.md) (despliegue).

## Desarrollo

Requiere Node 24 y Docker.

```bash
npm install
cp .env.example .env.local   # los valores locales ya funcionan con docker compose
npm run db:reset             # Postgres en Docker + migraciones + datos ficticios
npm run dev                  # http://localhost:3000
npm test                     # unitarios + permisos contra el Postgres local
```
