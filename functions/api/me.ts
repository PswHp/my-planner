import { cookieName, isSecure } from '../_lib/auth'
import type { Handler } from '../_lib/env'
import { HttpError, json, readJson, setCookie } from '../_lib/http'
import { logDeletedUser, purgeDeletedUsers } from '../_lib/deletedUsers'
import { rewardDate } from '../_lib/rewards'

/**
 * GET /api/me — 로그인 사용자 + 보유 코인 + 오늘 접속 보상 수령 여부
 * (페이지를 열 때 한 번만 호출되므로 보상 확인용 API를 따로 부르지 않음)
 * 앱을 열 때마다 보관 기간이 지난 탈퇴 기록도 함께 정리합니다.
 */
export const onRequestGet: Handler = async ({ env, data }) => {
  const date = rewardDate()
  const [, result] = await env.DB.batch([
    purgeDeletedUsers(env.DB),
    env.DB.prepare(
      `SELECT u.coins, EXISTS(SELECT 1 FROM daily_rewards WHERE user_id = u.id AND reward_date = ?2) AS claimed
         FROM users u WHERE u.id = ?1`,
    ).bind(data.user.id, date),
  ])
  const row = (result.results as { coins: number; claimed: number }[])[0]
  return json({ ...data.user, coins: row?.coins ?? 0, dailyReward: { date, claimed: row?.claimed === 1 } })
}

/** DELETE /api/me — 회원 탈퇴: 사용자의 모든 데이터와 세션을 즉시 삭제 (+ 탈퇴 기록: 해시된 ID와 시각만) */
export const onRequestDelete: Handler = async ({ env, request, data }) => {
  const body = await readJson(request)
  if (body.confirm !== data.user.email) throw new HttpError(400, '확인용 이메일이 일치하지 않습니다.')
  const uid = data.user.id
  await env.DB.batch([
    env.DB.prepare('DELETE FROM daily_rewards WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM user_accessories WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM time_blocks WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM tasks WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM events WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(uid),
    await logDeletedUser(env.DB, uid),
    purgeDeletedUsers(env.DB),
  ])
  const secure = isSecure(env, request)
  return json({ ok: true }, 200, { 'set-cookie': setCookie(cookieName('sid', secure), '', { maxAge: 0, secure }) })
}
