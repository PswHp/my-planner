import { appOrigin, cookieName, isSecure, pkceChallenge, randomToken } from '../../_lib/auth'
import type { Handler } from '../../_lib/env'
import { setCookie } from '../../_lib/http'

/** Google 로그인 화면으로 이동 (state + PKCE) */
export const onRequestGet: Handler = async ({ env, request }) => {
  const secure = isSecure(env, request)
  const state = randomToken(16)
  const verifier = randomToken(32) // 64자 hex — PKCE verifier 규격(43~128자) 충족
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${appOrigin(env, request)}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return new Response(null, {
    status: 302,
    headers: {
      location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'cache-control': 'no-store',
      'set-cookie': setCookie(cookieName('oauth', secure), `${state}.${verifier}`, { maxAge: 600, secure }),
    },
  })
}
