# Médicos en español · Emiratos

Directorio gratuito, comunitario y de código abierto de médicos que atienden en español en los Emiratos Árabes Unidos. Ver [CLAUDE.md](CLAUDE.md) (fuente de verdad) y [ROADMAP.md](ROADMAP.md).

## Desarrollo

```bash
npm install
cp .env.example .env.local   # rellena los valores
npx supabase start           # Postgres local (requiere Docker)
npx supabase db reset        # aplica migraciones y seed
npm run dev
npm test
```
