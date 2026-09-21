import { cookies } from 'next/headers'

// The challenge id lives only in this httpOnly cookie: knowing an id elsewhere never yields a session.
const NAME = 'login_challenge'
const PATH = '/api/auth'

export async function setChallengeCookie(id: string) {
  ;(await cookies()).set(NAME, id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: PATH, maxAge: 600 })
}
export const getChallengeCookie = async () => (await cookies()).get(NAME)?.value
export const clearChallengeCookie = async () => (await cookies()).delete({ name: NAME, path: PATH })
