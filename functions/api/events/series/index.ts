import type { Handler } from '../../../_lib/env'
import { json, readJson } from '../../../_lib/http'
import { assertBlockRoom, assertEventRoom, insertBlocksForEventSeries, insertEventStmt, pickCategory } from '../../../_lib/link'
import { pickSeriesFields, seriesDates } from '../../../_lib/series'

/**
 * POST /api/events/series — 반복 일정 일괄 추가
 * body: { title, description?, color?, all_day, start_time, end_time, from, until, days: [0~6], category? }
 * 선택한 기간 · 요일의 날짜마다 하루짜리 일정을 만들고 같은 series_id로 묶습니다.
 * 시간 일정이면 날짜마다 연결된 타임 블록도 함께 만듭니다. (전부 한 번의 트랜잭션)
 */
export const onRequestPost: Handler = async ({ env, request, data }) => {
  const body = await readJson(request)
  const fields = pickSeriesFields(body)
  const category = pickCategory(body.category)
  const dates = seriesDates(body.from, body.until, body.days)
  const uid = data.user.id
  const db = env.DB

  await assertEventRoom(db, uid, dates.length)
  if (!fields.all_day) await assertBlockRoom(db, uid, dates.length)

  const seriesId = crypto.randomUUID()
  const insert = insertEventStmt(db)
  await db.batch([
    ...dates.map((d) =>
      insert.bind(
        crypto.randomUUID(),
        uid,
        fields.title,
        fields.description,
        `${d}T${fields.start_time}`,
        `${d}T${fields.end_time}`,
        fields.all_day,
        fields.color,
        seriesId,
      ),
    ),
    insertBlocksForEventSeries(db, uid, seriesId, category),
  ])
  return json({ series_id: seriesId, count: dates.length, first: dates[0], last: dates[dates.length - 1] }, 201)
}
