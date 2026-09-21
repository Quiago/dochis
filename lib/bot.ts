import { normalize } from './directory'

const HELP = 'Soy el bot del directorio de médicos en español. Para entrar en la web, envía el mensaje CODIGO que te muestra la página. Pronto podrás confirmar tus datos escribiendo CONFIRMAR.'

// Replies to anything that is not a login code. CONFIRMAR, 1 and 2 arrive in Phase 4.
export function botReply(text: string): string {
  const t = normalize(text).trim()
  if (t === 'ayuda') return HELP
  if (['confirmar', '1', '2'].includes(t)) return 'Muy pronto podrás confirmar tus datos por aquí. Te avisaremos en el grupo.'
  return 'No entendí tu mensaje. Escribe AYUDA para ver qué puedo hacer.'
}
