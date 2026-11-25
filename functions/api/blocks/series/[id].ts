import { getOwned, pick } from '../../../_lib/crud'
import type { Handler } from '../../../_lib/env'
import { HttpError, json, readJson } from '../../../_lib/http'
import { insertEventsForBlockSeries, syncEventsForBlockSeries } from '../../../_lib/link'
import { assertRange, blockSeriesResource } from '../../../_lib/resources'

/**
 * PATCH /api/blocks/series/:id — 반복 블록 전체 수정
 * 각 블록의 날짜는 그대로 두고 제목 · 카테고리 · 시간 · 연결된 할 일만 한꺼번에 바꿉니다.
 * 연결된 일정도 함께 맞춥니다. (한 번의 트랜잭션)
 */
export const onRequestPatch: Handler<'id'> = async ({ env, request, data, params }) => {
  const values = pick(blockSeriesResource, await readJson(request), false)
  assertRange(values.start_min, values.end_min)
  const uid = data.user.id
  const seriesId = params.id as string
  if (values.task_id) await getOwned(env.DB, 'tasks', uid, values.task_id as string)
  const [result] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE time_blocks SET title = ?, category = ?, start_min = ?, end_min = ?, task_id = ?
        WHERE user_id = ? AND series_id = ?`,
    ).bind(values.title, values.category ?? 'work', values.start_min, values.end_min, values.task_id ?? null, uid, seriesId),
    syncEventsForBlockSeries(env.DB, uid, seriesId),
    ...insertEventsForBlockSeries(env.DB, uid, seriesId),
  ])
  if (!result.meta.changes) throw new HttpError(404, '반복 블록을 찾을 수 없습니다.')
  return json({ updated: result.meta.changes })
}

/** DELETE /api/blocks/series/:id — 반복 블록 전체 삭제 (연결된 일정도 함께) */
export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const uid = data.user.id
  const seriesId = params.id as string
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM time_blocks WHERE user_id = ? AND series_id = ?')
    .bind(uid, seriesId)
    .first<number>('n')
  if (!count) throw new HttpError(404, '반복 블록을 찾을 수 없습니다.')
  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM events WHERE user_id = ? AND id IN (SELECT event_id FROM time_blocks WHERE user_id = ? AND series_id = ? AND event_id IS NOT NULL)',
    ).bind(uid, uid, seriesId),
    env.DB.prepare('DELETE FROM time_blocks WHERE user_id = ? AND series_id = ?').bind(uid, seriesId),
  ])
  return json({ deleted: count })
}
