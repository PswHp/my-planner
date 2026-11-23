import { isSecure, SESSION_COOKIE, sha256 } from '../../_lib/auth'
import type { Handler } from '../../_lib/env'
import { getCookie, json, setCookie } from '../../_lib/http'

export const onRequestPost: Handler = async ({ env, request }) => {
  const token = getCookie(request, SESSION_COOKIE)
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run()
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': setCookie(SESSION_COOKIE, '', { maxAge: 0, secure: isSecure(env, request) }),
    },
  })
}

export const onRequestGet: Handler = async () => json({ error: 'POST로 요청하세요.' }, 405)
