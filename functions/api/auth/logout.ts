import { cookieName, isSecure, sha256 } from '../../_lib/auth'
import type { Handler } from '../../_lib/env'
import { getCookie, json, setCookie } from '../../_lib/http'

/** POST /api/auth/logout (Origin 검사는 미들웨어에서 수행) */
export const onRequestPost: Handler = async ({ env, request }) => {
  const secure = isSecure(env, request)
  const name = cookieName('sid', secure)
  const token = getCookie(request, name)
  if (token)
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?')
      .bind(await sha256(token))
      .run()
  return json({ ok: true }, 200, { 'set-cookie': setCookie(name, '', { maxAge: 0, secure }) })
}
