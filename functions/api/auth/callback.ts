import { appOrigin, isSecure, randomToken, SESSION_COOKIE, SESSION_DAYS, sha256, STATE_COOKIE } from '../../_lib/auth'
import type { Handler } from '../../_lib/env'
import { getCookie, setCookie } from '../../_lib/http'

interface GoogleClaims {
  iss: string
  aud: string
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
  exp: number
}

function decodeJwtPayload(jwt: string): GoogleClaims {
  const part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')), (c) =>
    c.charCodeAt(0),
  )
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** Google이 돌려보낸 code를 토큰으로 교환하고 세션을 만든다 */
export const onRequestGet: Handler = async ({ env, request }) => {
  const origin = appOrigin(env, request)
  const secure = isSecure(env, request)
  const url = new URL(request.url)
  const fail = (reason: string) =>
    new Response(null, {
      status: 302,
      headers: {
        location: `${origin}/?login_error=${encodeURIComponent(reason)}`,
        'set-cookie': setCookie(STATE_COOKIE, '', { maxAge: 0, secure }),
      },
    })

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state || state !== getCookie(request, STATE_COOKIE)) return fail('state')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) {
    console.error('token exchange failed', tokenRes.status, await tokenRes.text())
    return fail('token')
  }
  const { id_token } = (await tokenRes.json()) as { id_token?: string }
  if (!id_token) return fail('token')

  // id_token은 TLS로 Google 토큰 엔드포인트에서 직접 받았으므로 서명 검증 없이 클레임만 확인 (OIDC Core 3.1.3.7)
  const claims = decodeJwtPayload(id_token)
  const validIssuer = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com'
  if (!validIssuer || claims.aud !== env.GOOGLE_CLIENT_ID || claims.exp * 1000 < Date.now()) return fail('token')
  if (!claims.email_verified) return fail('unverified')

  const allowed = (env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length > 0 && !allowed.includes(claims.email.toLowerCase())) return fail('not_allowed')

  const token = randomToken()
  const expiresAt = Date.now() + SESSION_DAYS * 86400_000
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture`,
    ).bind(claims.sub, claims.email, claims.name ?? null, claims.picture ?? null),
    env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(
      await sha256(token),
      claims.sub,
      expiresAt,
    ),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
  ])

  const headers = new Headers({ location: `${origin}/` })
  headers.append('set-cookie', setCookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400, secure }))
  headers.append('set-cookie', setCookie(STATE_COOKIE, '', { maxAge: 0, secure }))
  return new Response(null, { status: 302, headers })
}
