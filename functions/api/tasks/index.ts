import { insertRow, pick } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { json, readJson } from '../../_lib/http'
import { taskResource } from '../../_lib/resources'

/** GET /api/tasks → 전체 할 일 (개인용이라 페이지네이션 없이) */
export const onRequestGet: Handler = async ({ env, data }) => {
  const { results } = await env.DB.prepare(
    `SELECT * FROM tasks WHERE user_id = ?
      ORDER BY done, due_date IS NULL, due_date, priority DESC, created_at DESC`,
  )
    .bind(data.user.id)
    .all()
  return json(results)
}

export const onRequestPost: Handler = async ({ env, request, data }) => {
  const values = pick(taskResource, await readJson(request), false)
  if (values.done === 1 && !values.completed_at) values.completed_at = values.created_at
  return json(await insertRow(env.DB, taskResource, data.user.id, values), 201)
}
