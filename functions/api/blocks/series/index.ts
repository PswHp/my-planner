import { getOwned, pick } from '../../../_lib/crud'
import type { Handler } from '../../../_lib/env'
import { HttpError, json, readJson } from '../../../_lib/http'
import { assertRange, blockResource, blockSeriesResource } from '../../../_lib/resources'
import { seriesDates } from '../../../_lib/series'

/**
 * POST /api/blocks/series — 타임 블록 일괄 추가
 * body: { title, category?, start_min, end_min, task_id?, from, until, days: [0~6] }
 * 선택한 기간 · 요일의 날짜마다 같은 시간의 블록을 만들고 같은 series_id로 묶습니다. (한 번의 트랜잭션)
 */
export const onRequestPost: Handler = async ({ env, request, data }) => {
  const body = await readJson(request)
  const values = pick(blockSeriesResource, body, false)
  assertRange(values.start_min, values.end_min)
  const dates = seriesDates(body.from, body.until, body.days)
  const uid = data.user.id
  const db = env.DB
  if (values.task_id) await getOwned(db, 'tasks', uid, values.task_id as string)

  const current = (await db.prepare('SELECT COUNT(*) AS n FROM time_blocks WHERE user_id = ?').bind(uid).first<number>('n')) ?? 0
  if (current + dates.length > blockResource.maxRows)
    throw new HttpError(
      429,
      `저장 가능한 최대 블록 수(${blockResource.maxRows.toLocaleString()}개)를 넘습니다. 기간을 줄이거나 오래된 블록을 정리해 주세요.`,
    )

  const seriesId = crypto.randomUUID()
  const insert = db.prepare(
    `INSERT INTO time_blocks (id, user_id, date, start_min, end_min, title, category, task_id, series_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  await db.batch(
    dates.map((d) =>
      insert.bind(
        crypto.randomUUID(),
        uid,
        d,
        values.start_min,
        values.end_min,
        values.title,
        values.category ?? 'work',
        values.task_id ?? null,
        seriesId,
      ),
    ),
  )
  return json({ series_id: seriesId, count: dates.length, first: dates[0], last: dates[dates.length - 1] }, 201)
}
