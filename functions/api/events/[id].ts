import { deleteRow, getOwned, pick, updateRow } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { json, readJson } from '../../_lib/http'
import { pickCategory, syncBlockForEvent } from '../../_lib/link'
import { assertRange, eventResource } from '../../_lib/resources'

/** PATCH /api/events/:id — 일정 수정 (+ 연결된 타임 블록도 맞춰 수정 · 생성 · 삭제) */
export const onRequestPatch: Handler<'id'> = async ({ env, request, data, params }) => {
  const id = params.id as string
  const body = await readJson(request)
  const values = pick(eventResource, body, true)
  const category = pickCategory(body.category)
  const current = await getOwned(env.DB, 'events', data.user.id, id)
  assertRange(values.start_at ?? current.start_at, values.end_at ?? current.end_at)
  const ev = (await updateRow(env.DB, eventResource, data.user.id, id, values)) as unknown as Parameters<typeof syncBlockForEvent>[2]
  await syncBlockForEvent(env.DB, data.user.id, ev, category)
  return json(ev)
}

/** DELETE /api/events/:id — 연결된 타임 블록은 DB에서 함께 삭제됨 */
export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  await deleteRow(env.DB, 'events', data.user.id, params.id as string)
  return json({ ok: true })
}
