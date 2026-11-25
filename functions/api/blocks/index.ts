import { getOwned, pick } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { json, readJson, requireDate } from '../../_lib/http'
import { assertBlockRoom, assertEventRoom, CATEGORY_COLOR, eventTimeFromBlock, insertBlockStmt, insertEventStmt } from '../../_lib/link'
import { assertRange, blockResource } from '../../_lib/resources'

/** GET /api/blocks?from=YYYY-MM-DD&to=YYYY-MM-DD */
export const onRequestGet: Handler = async ({ env, request, data }) => {
  const url = new URL(request.url)
  const from = requireDate(url.searchParams.get('from'), 'from')
  const to = requireDate(url.searchParams.get('to'), 'to')
  const { results } = await env.DB.prepare(`SELECT * FROM time_blocks WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, start_min`)
    .bind(data.user.id, from, to)
    .all()
  return json(results)
}

/** POST /api/blocks — 블록 추가 (+ 같은 시간의 일정을 함께 만들어 연결, 한 번의 트랜잭션) */
export const onRequestPost: Handler = async ({ env, request, data }) => {
  const values = pick(blockResource, await readJson(request), false)
  assertRange(values.start_min, values.end_min)
  const uid = data.user.id
  const db = env.DB
  if (values.task_id) await getOwned(db, 'tasks', uid, values.task_id as string)
  await assertBlockRoom(db, uid)
  await assertEventRoom(db, uid)

  const category = (values.category as string) ?? 'work'
  const eventId = crypto.randomUUID()
  const blockId = crypto.randomUUID()
  const time = eventTimeFromBlock(values.date as string, values.start_min as number, values.end_min as number)
  await db.batch([
    insertEventStmt(db).bind(eventId, uid, values.title, '', time.start_at, time.end_at, 0, CATEGORY_COLOR[category] ?? 'yellow', null),
    insertBlockStmt(db).bind(
      blockId,
      uid,
      values.date,
      values.start_min,
      values.end_min,
      values.title,
      category,
      values.task_id ?? null,
      null,
      eventId,
    ),
  ])
  return json(await db.prepare('SELECT * FROM time_blocks WHERE id = ?').bind(blockId).first(), 201)
}
