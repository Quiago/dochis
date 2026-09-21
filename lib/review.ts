// Automatic profile review: nobody approves by hand. Own rules always run; Bedrock (if configured) adds judgement.
// Official registries sit behind CAPTCHAs, so licences are published for people to check, never scraped.
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import type postgres from 'postgres'
import { normalize } from './directory.ts'
import type { ProfileData } from './profile.ts'

export type Review = { ok: boolean; issues: string[] }
type Invoke = (prompt: string) => Promise<string>

// Loose on purpose: DHA uses numbers, DOH codes like GD12345, some include slashes or dashes.
export function licenseFormatIssue(license: string): string | null {
  const ok = /^[A-Za-z0-9/-]{4,20}$/.test(license) && (license.match(/\d/g) ?? []).length >= 3
  return ok ? null : 'El número de licencia no tiene un formato reconocible.'
}

const PROMPT = `Eres el revisor automático de un directorio comunitario de médicos que atienden en español en los Emiratos Árabes Unidos.
Tu único trabajo es frenar abusos evidentes. Devuelve SOLO un JSON {"problemas": ["..."]} en español.
Marca un problema SOLO si es evidente sin necesidad de comprobar nada fuera del perfil:
- el nombre claramente no es de una persona (publicidad, frases, insultos, texto sin sentido);
- la especialidad claramente no es sanitaria;
- hay spam, publicidad o texto ofensivo en cualquier campo;
- hay enlaces, correos o teléfonos metidos en campos que no son de contacto.
NO marques nunca: que no puedas comprobar si la persona, la clínica o la licencia existen; nombres o clínicas poco
conocidos; tildes, mayúsculas, abreviaturas o idiomas; que se muestre el número de licencia (es público a propósito).
En la duda, no marques. Si todo está bien: {"problemas": []}.

Perfil:
`

let client: BedrockRuntimeClient | undefined
const bedrock: Invoke = async (prompt) => {
  client ??= new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION })
  const res = await client.send(new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID,
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 300, temperature: 0 },
  }), { abortSignal: AbortSignal.timeout(8000) })
  return res.output?.message?.content?.[0]?.text ?? ''
}

// Never blocks a sign-up: any model error or unreadable answer counts as "no issues".
export async function llmIssues(data: ProfileData, invoke?: Invoke): Promise<string[]> {
  if (!invoke && !process.env.BEDROCK_MODEL_ID) return []
  try {
    const { public_whatsapp: _phone, ...professional } = data  // the model never sees phone numbers
    const text = await (invoke ?? bedrock)(PROMPT + JSON.stringify(professional, null, 2))
    const json = text.match(/\{[\s\S]*\}/)?.[0]
    const problems = json ? JSON.parse(json).problemas : []
    return Array.isArray(problems) ? problems.filter((p): p is string => typeof p === 'string').slice(0, 5) : []
  } catch (e) {
    console.error('bedrock review', e)
    return []
  }
}

export async function reviewProfile(
  sql: postgres.Sql | postgres.TransactionSql, data: ProfileData, { excludeId }: { excludeId?: string } = {}, { invoke }: { invoke?: Invoke } = {},
): Promise<Review> {
  const issues: string[] = []
  const format = licenseFormatIssue(data.license_number)
  if (format) issues.push(format)

  const other = excludeId ?? '00000000-0000-0000-0000-000000000000'
  const [dupLicense] = await sql`
    select 1 from doctors where regulator = ${data.regulator} and upper(license_number) = upper(${data.license_number})
      and id <> ${other} and status <> 'hidden'`
  if (dupLicense) issues.push('Esa licencia ya está en otro perfil del directorio.')

  const name = normalize(data.full_name).replace(/\s+/g, ' ').trim()
  const live = await sql`select id, full_name from doctors where status in ('verified', 'stale') and id <> ${other}`
  if (live.some((d) => normalize(d.full_name).replace(/\s+/g, ' ').trim() === name)) issues.push('Ya hay un perfil publicado con ese nombre.')

  issues.push(...(await llmIssues(data, invoke)))
  return { ok: issues.length === 0, issues }
}
