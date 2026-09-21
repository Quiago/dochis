// Imports the group's spreadsheet as unclaimed profiles and writes a review report.
//   node --env-file=.env.local scripts/import-csv.ts "<archivo.csv>" [--dry-run]
// The CSV holds real people's data: it is gitignored and the report goes to data/ (also gitignored).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import postgres from 'postgres'
import { importDoctors, parseCsv, prepareImport } from '../lib/import.ts'

const [file, flag] = process.argv.slice(2)
if (!file) { console.error('Uso: node scripts/import-csv.ts <archivo.csv> [--dry-run]'); process.exit(1) }
const dryRun = flag === '--dry-run'

const { doctors, skipped, specialties } = prepareImport(parseCsv(readFileSync(file, 'utf8')))
let dbSkipped: typeof skipped = []
let inserted: string[] = []
if (!dryRun) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
  ;({ inserted, skipped: dbSkipped } = await importDoctors(sql, doctors))
  await sql.end()
}

const count = (key: 'specialty' | 'emirate') =>
  Object.entries(doctors.reduce<Record<string, number>>((m, d) => ({ ...m, [d[key]]: (m[d[key]] ?? 0) + 1 }), {}))
    .sort(([a], [b]) => a.localeCompare(b, 'es')).map(([k, n]) => `| ${k} | ${n} |`).join('\n')
const report = `# Informe de importación ${dryRun ? '(simulación)' : ''}

- Filas preparadas: **${doctors.length}** · importadas: **${dryRun ? '—' : inserted.length}**
- Con teléfono móvil de acceso: ${doctors.filter((d) => d.phone_e164).length} · con correo: ${doctors.filter((d) => d.email).length}
- Omitidas: ${skipped.length + dbSkipped.length}

## Especialidades (texto original → normalizada)
| Original | Normalizada | |
|---|---|---|
${[...specialties].sort(([, a], [, b]) => a.value.localeCompare(b.value, 'es')).map(([raw, s]) => `| ${raw} | ${s.value} | ${s.mapped ? '' : '⚠️ revisar'} |`).join('\n')}

## Médicos por especialidad
| Especialidad | Médicos |
|---|---|
${count('specialty')}

## Médicos por emirato
| Emirato | Médicos |
|---|---|
${count('emirate')}

## Omitidas
| Línea | Nombre | Motivo |
|---|---|---|
${[...skipped, ...dbSkipped].map((s) => `| ${s.line} | ${s.name} | ${s.reason} |`).join('\n')}
`
mkdirSync('data', { recursive: true })
writeFileSync('data/import-report.md', report)
console.log(`${dryRun ? 'Simulación' : 'Importación'}: ${doctors.length} preparadas, ${dryRun ? 0 : inserted.length} importadas, ${skipped.length + dbSkipped.length} omitidas. Informe: data/import-report.md`)
