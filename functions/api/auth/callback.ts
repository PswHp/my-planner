import { appOrigin, cookieName, isSecure, randomToken, SESSION_DAYS, sha256 } from '../../_lib/auth'
import type { Handler } from '../../_lib/env'
import { purgeDeletedUsers } from '../../_lib/deletedUsers'
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
  const bytes = Uint8Array.from(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

const clip = (s: string | undefined, max: number) => (s ? s.slice(0, max) : null)

/** Google이 돌려보낸 code를 토큰으로 교환하고 세션을 만든다 */
export const onRequestGet: Handler = async ({ env, request }) => {
  const origin = appOrigin(env, request)
  const secure = isSecure(env, request)
  const oauthCookie = cookieName('oauth', secure)
  const url = new URL(request.url)
  const clearOauth = setCookie(oauthCookie, '', { maxAge: 0, secure })
  const fail = (reason: string) =>
    new Response(null, {
      status: 302,
      headers: { location: `${origin}/?login_error=${encodeURIComponent(reason)}`, 'set-cookie': clearOauth },
    })

  if (url.searchParams.get('error')) return fail('cancelled')

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const [savedState, verifier] = (getCookie(request, oauthCookie) ?? '').split('.')
  if (!code || !state || !savedState || !verifier || state !== savedState) return fail('state')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/callback`,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!tokenRes.ok) {
    // Google 오류 코드만 기록 (예: invalid_client = Client Secret 불일치, invalid_grant = 코드 만료/재사용)
    const body = (await tokenRes.json().catch(() => ({}))) as { error?: string; error_description?: string }
    console.error('token exchange failed', tokenRes.status, body.error, body.error_description)
    return fail('token')
  }
  const { id_token } = (await tokenRes.json()) as { id_token?: string }
  if (!id_token) {
    console.error('token response has no id_token')
    return fail('token')
  }

  // id_token은 TLS로 Google 토큰 엔드포인트에서 직접 받았으므로 서명 검증 없이 클레임만 확인 (OIDC Core 3.1.3.7)
  const claims = decodeJwtPayload(id_token)
  const validIssuer = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com'
  if (!validIssuer || claims.aud !== env.GOOGLE_CLIENT_ID || claims.exp * 1000 < Date.now()) {
    console.error('id_token claim check failed', { validIssuer, audMatches: claims.aud === env.GOOGLE_CLIENT_ID })
    return fail('token')
  }
  if (!claims.email_verified) return fail('unverified')

  // 선택: 특정 이메일만 허용하고 싶을 때 (비워두면 모든 구글 계정 허용)
  const allowed = (env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length > 0 && !allowed.includes(claims.email.toLowerCase())) return fail('not_allowed')

  const token = randomToken()
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture`,
    ).bind(claims.sub, clip(claims.email, 320), clip(claims.name, 200), clip(claims.picture, 1000)),
    env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(
      await sha256(token),
      claims.sub,
      now + SESSION_DAYS * 86400_000,
    ),
    // 만료 세션 · 보관 기간이 지난 탈퇴 기록 정리 + 한 사용자당 최근 세션 20개만 유지
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    purgeDeletedUsers(env.DB),
    env.DB.prepare(
      `DELETE FROM sessions WHERE user_id = ? AND id NOT IN
         (SELECT id FROM sessions WHERE user_id = ? ORDER BY expires_at DESC LIMIT 20)`,
    ).bind(claims.sub, claims.sub),
  ])

  const headers = new Headers({ location: `${origin}/`, 'cache-control': 'no-store' })
  headers.append('set-cookie', setCookie(cookieName('sid', secure), token, { maxAge: SESSION_DAYS * 86400, secure }))
  headers.append('set-cookie', clearOauth)
  return new Response(null, { status: 302, headers })
}
