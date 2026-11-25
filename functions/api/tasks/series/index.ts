import { f, pick } from '../../../_lib/crud'
import type { Handler } from '../../../_lib/env'
import { HttpError, json, readJson } from '../../../_lib/http'
import { taskResource, taskSeriesResource } from '../../../_lib/resources'
import { seriesDates } from '../../../_lib/series'

/**
 * POST /api/tasks/series — 할 일 일괄 추가
 * body: { title, notes?, priority?, from, until, days: [0~6], created_at }
 * 선택한 기간 · 요일의 날짜마다 그날이 마감인 할 일을 만들고 같은 series_id로 묶습니다. (한 번의 트랜잭션)
 */
export const onRequestPost: Handler = async ({ env, request, data }) => {
  const body = await readJson(request)
  const values = pick(taskSeriesResource, body, false)
  const createdAt = f.datetime()(body.created_at, 'created_at') as string
  const dates = seriesDates(body.from, body.until, body.days)
  const uid = data.user.id
  const db = env.DB

  const current = (await db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?').bind(uid).first<number>('n')) ?? 0
  if (current + dates.length > taskResource.maxRows)
    throw new HttpError(
      429,
      `저장 가능한 최대 할 일 수(${taskResource.maxRows.toLocaleString()}개)를 넘습니다. 기간을 줄이거나 오래된 할 일을 정리해 주세요.`,
    )

  const seriesId = crypto.randomUUID()
  const insert = db.prepare(
    `INSERT INTO tasks (id, user_id, title, notes, due_date, priority, done, completed_at, created_at, series_id)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
  )
  await db.batch(
    dates.map((d) => insert.bind(crypto.randomUUID(), uid, values.title, values.notes ?? '', d, values.priority ?? 0, createdAt, seriesId)),
  )
  return json({ series_id: seriesId, count: dates.length, first: dates[0], last: dates[dates.length - 1] }, 201)
}
