import { insertRow, pick } from '../../_lib/crud'
import type { Handler } from '../../_lib/env'
import { json, readJson, requireDate } from '../../_lib/http'
import { assertBlockRoom, blockTimeFromEvent, categoryFromColor, insertBlockStmt, pickCategory } from '../../_lib/link'
import { assertRange, eventResource } from '../../_lib/resources'

/**
 * GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD → 기간과 겹치는 일정
 * block_category: 연결된 타임 블록의 카테고리 (연결된 블록이 없으면 null)
 */
export const onRequestGet: Handler = async ({ env, request, data }) => {
  const url = new URL(request.url)
  const from = requireDate(url.searchParams.get('from'), 'from')
  const to = requireDate(url.searchParams.get('to'), 'to')
  const { results } = await env.DB.prepare(
    `SELECT e.*, b.category AS block_category
       FROM events e LEFT JOIN time_blocks b ON b.event_id = e.id
      WHERE e.user_id = ? AND e.start_at <= ? AND e.end_at >= ?
      ORDER BY e.start_at`,
  )
    .bind(data.user.id, `${to}T23:59`, `${from}T00:00`)
    .all()
  return json(results)
}

/** POST /api/events — 일정 추가 (+ 하루 안의 시간 일정이면 연결된 타임 블록도 함께) */
export const onRequestPost: Handler = async ({ env, request, data }) => {
  const body = await readJson(request)
  const values = pick(eventResource, body, false)
  assertRange(values.start_at, values.end_at)
  const category = pickCategory(body.category)
  const uid = data.user.id
  const time = blockTimeFromEvent({
    start_at: values.start_at as string,
    end_at: values.end_at as string,
    all_day: Number(values.all_day ?? 0),
  })
  if (time) await assertBlockRoom(env.DB, uid)

  const ev = (await insertRow(env.DB, eventResource, uid, values)) as Record<string, unknown>
  if (time) {
    await insertBlockStmt(env.DB)
      .bind(
        crypto.randomUUID(),
        uid,
        time.date,
        time.start_min,
        time.end_min,
        ev.title,
        category ?? categoryFromColor(ev.color),
        null,
        null,
        ev.id,
      )
      .run()
  }
  return json({ ...ev, block_category: time ? (category ?? categoryFromColor(ev.color)) : null }, 201)
}
