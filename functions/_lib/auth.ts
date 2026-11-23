import type { Env, User } from './env'

export const SESSION_COOKIE = 'sid'
export const STATE_COOKIE = 'oauth_state'
export const SESSION_DAYS = 30

export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 브라우저가 보는 사이트 주소. 로컬에서는 Vite 프록시 뒤에 있으므로 APP_URL로 지정 */
export function appOrigin(env: Env, request: Request): string {
  return (env.APP_URL || new URL(request.url).origin).replace(/\/$/, '')
}

export function isSecure(env: Env, request: Request): boolean {
  return appOrigin(env, request).startsWith('https://')
}

export async function userFromSession(env: Env, token: string | null): Promise<User | null> {
  if (!token) return null
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.picture, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`,
  )
    .bind(await sha256(token))
    .first<User & { expires_at: number }>()
  if (!row || row.expires_at < Date.now()) return null
  return { id: row.id, email: row.email, name: row.name, picture: row.picture }
}
