import { appOrigin, isSecure, randomToken, STATE_COOKIE } from '../../_lib/auth'
import type { Handler } from '../../_lib/env'
import { setCookie } from '../../_lib/http'

/** Google 로그인 화면으로 이동 */
export const onRequestGet: Handler = async ({ env, request }) => {
  const state = randomToken(16)
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${appOrigin(env, request)}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return new Response(null, {
    status: 302,
    headers: {
      location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'set-cookie': setCookie(STATE_COOKIE, state, { maxAge: 600, secure: isSecure(env, request) }),
    },
  })
}
