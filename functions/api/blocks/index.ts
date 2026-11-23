import { getOwned, insertRow, pick } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { json, readJson, requireDate } from '../../_lib/http'
import { assertRange, blockResource } from '../../_lib/resources'

/** GET /api/blocks?from=YYYY-MM-DD&to=YYYY-MM-DD */
export const onRequestGet: Handler = async ({ env, request, data }) => {
  const url = new URL(request.url)
  const from = requireDate(url.searchParams.get('from'), 'from')
  const to = requireDate(url.searchParams.get('to'), 'to')
  const { results } = await env.DB.prepare(
    `SELECT * FROM time_blocks WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, start_min`,
  )
    .bind(data.user.id, from, to)
    .all()
  return json(results)
}

export const onRequestPost: Handler = async ({ env, request, data }) => {
  const values = pick(blockResource, await readJson(request), false)
  assertRange(values.start_min, values.end_min)
  if (values.task_id) await getOwned(env.DB, 'tasks', data.user.id, values.task_id as string)
  return json(await insertRow(env.DB, blockResource, data.user.id, values), 201)
}
