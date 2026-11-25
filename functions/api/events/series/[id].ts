import type { Handler } from '../../../_lib/env'
import { HttpError, json, readJson } from '../../../_lib/http'
import { pickCategory, syncBlocksForEventSeries } from '../../../_lib/link'
import { pickSeriesFields } from '../../../_lib/series'

/**
 * PATCH /api/events/series/:id — 반복 일정 전체 수정
 * 각 일정의 날짜는 그대로 두고 제목 · 메모 · 색 · 종일 여부 · 시간만 한꺼번에 바꿉니다.
 * 연결된 타임 블록도 함께 맞춥니다. (한 번의 트랜잭션)
 */
export const onRequestPatch: Handler<'id'> = async ({ env, request, data, params }) => {
  const body = await readJson(request)
  const fields = pickSeriesFields(body)
  const category = pickCategory(body.category)
  const uid = data.user.id
  const seriesId = params.id as string
  const [result] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE events
          SET title = ?, description = ?, color = ?, all_day = ?,
              start_at = substr(start_at, 1, 10) || 'T' || ?,
              end_at = substr(start_at, 1, 10) || 'T' || ?
        WHERE user_id = ? AND series_id = ?`,
    ).bind(fields.title, fields.description, fields.color, fields.all_day, fields.start_time, fields.end_time, uid, seriesId),
    ...syncBlocksForEventSeries(env.DB, uid, seriesId, category),
  ])
  if (!result.meta.changes) throw new HttpError(404, '반복 일정을 찾을 수 없습니다.')
  return json({ updated: result.meta.changes })
}

/** DELETE /api/events/series/:id — 반복 일정 전체 삭제 (연결된 블록은 DB에서 함께 삭제됨) */
export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const result = await env.DB.prepare('DELETE FROM events WHERE user_id = ? AND series_id = ?')
    .bind(data.user.id, params.id as string)
    .run()
  if (!result.meta.changes) throw new HttpError(404, '반복 일정을 찾을 수 없습니다.')
  return json({ deleted: result.meta.changes })
}
