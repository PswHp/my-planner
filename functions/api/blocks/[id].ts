import { getOwned, pick, updateRow } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { json, readJson } from '../../_lib/http'
import { assertEventRoom, CATEGORY_COLOR, eventTimeFromBlock, insertEventStmt } from '../../_lib/link'
import { assertRange, blockResource } from '../../_lib/resources'

interface BlockRow {
  id: string
  date: string
  start_min: number
  end_min: number
  title: string
  category: string
  series_id: string | null
  event_id: string | null
}

/** PATCH /api/blocks/:id — 블록 수정 (+ 연결된 일정도 맞춰 수정, 연결이 없던 블록이면 일정을 만들어 연결) */
export const onRequestPatch: Handler<'id'> = async ({ env, request, data, params }) => {
  const id = params.id as string
  const uid = data.user.id
  const db = env.DB
  const values = pick(blockResource, await readJson(request), true)
  const current = await getOwned<BlockRow>(db, 'time_blocks', uid, id)
  assertRange(values.start_min ?? current.start_min, values.end_min ?? current.end_min)
  if (values.task_id) await getOwned(db, 'tasks', uid, values.task_id as string)
  const b = (await updateRow(db, blockResource, uid, id, values)) as unknown as BlockRow

  const time = eventTimeFromBlock(b.date, b.start_min, b.end_min)
  const linked = b.event_id ? await db.prepare('SELECT id FROM events WHERE id = ? AND user_id = ?').bind(b.event_id, uid).first() : null
  if (linked) {
    // 카테고리를 바꿨을 때만 일정 색도 카테고리 색으로 (직접 고른 일정 색 유지)
    const recolor = values.category !== undefined && values.category !== current.category
    await db
      .prepare(
        `UPDATE events SET title = ?, start_at = ?, end_at = ?, all_day = 0${recolor ? ', color = ?' : ''} WHERE id = ? AND user_id = ?`,
      )
      .bind(...[b.title, time.start_at, time.end_at, ...(recolor ? [CATEGORY_COLOR[b.category] ?? 'yellow'] : []), b.event_id, uid])
      .run()
  } else {
    await assertEventRoom(db, uid)
    const eventId = crypto.randomUUID()
    await db.batch([
      insertEventStmt(db).bind(
        eventId,
        uid,
        b.title,
        '',
        time.start_at,
        time.end_at,
        0,
        CATEGORY_COLOR[b.category] ?? 'yellow',
        b.series_id,
      ),
      db.prepare('UPDATE time_blocks SET event_id = ? WHERE id = ?').bind(eventId, b.id),
    ])
    b.event_id = eventId
  }
  return json(b)
}

/** DELETE /api/blocks/:id — 연결된 일정이 있으면 일정을 지움(블록은 DB에서 함께 삭제됨) */
export const onRequestDelete: Handler<'id'> = async ({ env, data, params }) => {
  const uid = data.user.id
  const b = await getOwned<BlockRow>(env.DB, 'time_blocks', uid, params.id as string)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').bind(b.event_id ?? '', uid),
    env.DB.prepare('DELETE FROM time_blocks WHERE id = ? AND user_id = ?').bind(b.id, uid),
  ])
  return json({ ok: true })
}
