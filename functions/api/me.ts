import { cookieName, isSecure } from '../_lib/auth'
import type { Handler } from '../_lib/env'
import { HttpError, json, readJson, setCookie } from '../_lib/http'

export const onRequestGet: Handler = async ({ data }) => json(data.user)

/** DELETE /api/me — 회원 탈퇴: 사용자의 모든 데이터와 세션을 즉시 삭제 */
export const onRequestDelete: Handler = async ({ env, request, data }) => {
  const body = await readJson(request)
  if (body.confirm !== data.user.email) throw new HttpError(400, '확인용 이메일이 일치하지 않습니다.')
  const uid = data.user.id
  await env.DB.batch([
    env.DB.prepare('DELETE FROM time_blocks WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM tasks WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM events WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(uid),
  ])
  const secure = isSecure(env, request)
  return json({ ok: true }, 200, { 'set-cookie': setCookie(cookieName('sid', secure), '', { maxAge: 0, secure }) })
}
