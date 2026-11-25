import { pick } from '../../../_lib/crud'
import type { Handler } from '../../../_lib/env'
import { HttpError, json, readJson } from '../../../_lib/http'
import { taskSeriesResource } from '../../../_lib/resources'

/**
 * PATCH /api/tasks/series/:id — 반복 할 일 전체 수정
 * 각 할 일의 마감일과 완료 여부는 그대로 두고 제목 · 메모 · 우선순위만 한꺼번에 바꿉니다.
 */
export const onRequestPatch: Handler<'id'> = async ({ env, request, data, params }) => {
  const values = pick(taskSeriesResource, await readJson(request), false)
  const result = await env.DB.prepare(`UPDATE tasks SET title = ?, notes = ?, priority = ? WHERE user_id = ? AND series_id = ?`)
    .bind(values.title, values.notes ?? '', values.priority ?? 0, data.user.id, params.id as string)
    .run()
  if (!result.meta.changes) throw new HttpError(404, '반복 할 일을 찾을 수 없습니다.')
  return json({ updated: result.meta.changes })
}

/** DELETE /api/tasks/series/:id — 반복 할 일 전체 삭제 (연결된 타임 블록은 연결만 해제됨) */
export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const result = await env.DB.prepare('DELETE FROM tasks WHERE user_id = ? AND series_id = ?')
    .bind(data.user.id, params.id as string)
    .run()
  if (!result.meta.changes) throw new HttpError(404, '반복 할 일을 찾을 수 없습니다.')
  return json({ deleted: result.meta.changes })
}
