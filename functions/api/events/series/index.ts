import type { Handler } from '../../../_lib/env'
import { HttpError, json, readJson } from '../../../_lib/http'
import { eventResource } from '../../../_lib/resources'
import { pickSeriesFields, seriesDates } from '../../../_lib/series'

/**
 * POST /api/events/series — 반복 일정 일괄 추가
 * body: { title, description?, color?, all_day, start_time, end_time, from, until, days: [0~6] }
 * 선택한 기간 · 요일의 날짜마다 하루짜리 일정을 만들고 같은 series_id로 묶습니다. (한 번의 트랜잭션)
 */
export const onRequestPost: Handler = async ({ env, request, data }) => {
  const body = await readJson(request)
  const fields = pickSeriesFields(body)
  const dates = seriesDates(body.from, body.until, body.days)
  const uid = data.user.id
  const db = env.DB

  const current = (await db.prepare('SELECT COUNT(*) AS n FROM events WHERE user_id = ?').bind(uid).first<number>('n')) ?? 0
  if (current + dates.length > eventResource.maxRows)
    throw new HttpError(
      429,
      `저장 가능한 최대 일정 수(${eventResource.maxRows.toLocaleString()}개)를 넘습니다. 기간을 줄이거나 오래된 일정을 정리해 주세요.`,
    )

  const seriesId = crypto.randomUUID()
  const insert = db.prepare(
    `INSERT INTO events (id, user_id, title, description, start_at, end_at, all_day, color, series_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  await db.batch(
    dates.map((d) =>
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
  )
  return json({ series_id: seriesId, count: dates.length, first: dates[0], last: dates[dates.length - 1] }, 201)
}
