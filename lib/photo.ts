// Doctor photo or icon: resized to 256×256 in the browser, validated by its bytes here, reviewed by Bedrock (Nova Lite).
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import type postgres from 'postgres'

const MAX_BYTES = 200_000
type PhotoType = 'image/jpeg' | 'image/webp'

// Trust the bytes, never the browser's MIME type: only real JPEG/WebP can be served back as images.
export function validatePhoto(bytes: Uint8Array): { type: PhotoType } | { error: string } {
  if (!bytes.length || bytes.length > MAX_BYTES) return { error: 'La foto debe pesar menos de 200 KB.' }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: 'image/jpeg' }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { type: 'image/webp' }
  return { error: 'Sube una imagen JPG o WebP.' }
}

const PROMPT = `Eres el revisor de fotos de perfil de un directorio de médicos. La imagen debe ser apropiada para un perfil
profesional: un retrato, un logotipo o un icono. Marca como no apropiada SOLO si hay desnudez, contenido sexual, violencia,
odio, o publicidad/datos de contacto como texto principal. Devuelve SOLO un JSON {"apropiada": true} o
{"apropiada": false, "motivo": "<motivo breve en español>"}.`

type Invoke = (bytes: Uint8Array, type: PhotoType) => Promise<string>
let client: BedrockRuntimeClient | undefined
const bedrock: Invoke = async (bytes, type) => {
  client ??= new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION })
  const res = await client.send(new ConverseCommand({
    modelId: process.env.PHOTO_MODEL_ID,
    messages: [{ role: 'user', content: [{ image: { format: type === 'image/webp' ? 'webp' : 'jpeg', source: { bytes } } }, { text: PROMPT }] }],
    inferenceConfig: { maxTokens: 100, temperature: 0 },
  }), { abortSignal: AbortSignal.timeout(10_000) })
  return res.output?.message?.content?.[0]?.text ?? ''
}

// Reason to reject, or null. Never blocks on model errors (community reports remain the safety net).
export async function photoIssue(bytes: Uint8Array, type: PhotoType, invoke?: Invoke): Promise<string | null> {
  if (!invoke && !process.env.PHOTO_MODEL_ID) return null
  try {
    const json = (await (invoke ?? bedrock)(bytes, type)).match(/\{[\s\S]*\}/)?.[0]
    const r = json ? JSON.parse(json) : {}
    return r.apropiada === false ? String(r.motivo || 'La imagen no parece adecuada para un perfil profesional.') : null
  } catch (e) {
    console.error('bedrock photo', e)
    return null
  }
}

export async function setPhoto(sql: postgres.Sql, doctorId: string, bytes: Uint8Array | null, type: PhotoType | null) {
  await sql`update doctors set photo = ${bytes ? Buffer.from(bytes) : null}, photo_type = ${type}, photo_updated_at = now() where id = ${doctorId}`
}
