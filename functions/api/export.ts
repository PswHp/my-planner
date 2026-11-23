import type { Handler } from '../_lib/env'
import { json } from '../_lib/http'

/** GET /api/export — 내 데이터 전체를 JSON 파일로 내려받기 */
export const onRequestGet: Handler = async ({ env, data }) => {
  const uid = data.user.id
  const [events, tasks, blocks] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY start_at').bind(uid),
    env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at').bind(uid),
    env.DB.prepare('SELECT * FROM time_blocks WHERE user_id = ? ORDER BY date, start_min').bind(uid),
  ])
  const strip = (rows: Record<string, unknown>[]) => rows.map(({ user_id: _, ...rest }) => rest)
  return json(
    {
      exported_at: new Date().toISOString(),
      user: data.user,
      events: strip(events.results as Record<string, unknown>[]),
      tasks: strip(tasks.results as Record<string, unknown>[]),
      time_blocks: strip(blocks.results as Record<string, unknown>[]),
    },
    200,
    { 'content-disposition': 'attachment; filename="planner-export.json"' },
  )
}
