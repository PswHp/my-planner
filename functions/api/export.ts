import type { Handler } from '../_lib/env'
import { json } from '../_lib/http'

/** GET /api/export — 내 데이터 전체를 JSON 파일로 내려받기 */
export const onRequestGet: Handler = async ({ env, data }) => {
  const uid = data.user.id
  const [events, tasks, blocks, accessories, rewards, wallet] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY start_at').bind(uid),
    env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at').bind(uid),
    env.DB.prepare('SELECT * FROM time_blocks WHERE user_id = ? ORDER BY date, start_min').bind(uid),
    env.DB.prepare('SELECT accessory_id, acquired_at FROM user_accessories WHERE user_id = ? ORDER BY acquired_at').bind(uid),
    env.DB.prepare(
      'SELECT reward_date, accessory_id, rarity, duplicate, coins FROM daily_rewards WHERE user_id = ? ORDER BY reward_date',
    ).bind(uid),
    env.DB.prepare('SELECT coins FROM users WHERE id = ?').bind(uid),
  ])
  const strip = (rows: Record<string, unknown>[]) => rows.map(({ user_id: _, ...rest }) => rest)
  return json(
    {
      exported_at: new Date().toISOString(),
      user: data.user,
      events: strip(events.results as Record<string, unknown>[]),
      tasks: strip(tasks.results as Record<string, unknown>[]),
      time_blocks: strip(blocks.results as Record<string, unknown>[]),
      coins: (wallet.results[0] as { coins?: number } | undefined)?.coins ?? 0,
      accessories: accessories.results,
      daily_rewards: rewards.results,
    },
    200,
    { 'content-disposition': 'attachment; filename="planner-export.json"' },
  )
}
