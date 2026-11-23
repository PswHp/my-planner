import { insertRow, pick } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { json, readJson, requireDate } from '../../_lib/http'
import { assertRange, eventResource } from '../../_lib/resources'

/** GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD → 기간과 겹치는 일정 */
export const onRequestGet: Handler = async ({ env, request, data }) => {
  const url = new URL(request.url)
  const from = requireDate(url.searchParams.get('from'), 'from')
  const to = requireDate(url.searchParams.get('to'), 'to')
  const { results } = await env.DB.prepare(
    `SELECT * FROM events WHERE user_id = ? AND start_at <= ? AND end_at >= ? ORDER BY start_at`,
  )
    .bind(data.user.id, `${to}T23:59`, `${from}T00:00`)
    .all()
  return json(results)
}

export const onRequestPost: Handler = async ({ env, request, data }) => {
  const values = pick(eventResource, await readJson(request), false)
  assertRange(values.start_at, values.end_at)
  return json(await insertRow(env.DB, eventResource, data.user.id, values), 201)
}
