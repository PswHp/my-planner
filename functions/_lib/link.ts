import { f } from './crud'
import { HttpError } from './http'
import { blockResource, CATEGORIES, eventResource } from './resources'

/**
 * 일정 ↔ 타임 블록 연결
 * - 일정을 만들면 같은 시간의 블록이, 블록을 만들면 같은 시간의 일정이 함께 생깁니다 (time_blocks.event_id 로 연결).
 * - 한쪽을 고치면 다른 쪽도 맞춰 바뀌고, 일정이 지워지면 연결된 블록은 DB에서 함께 지워집니다 (ON DELETE CASCADE).
 * - 종일 일정 · 여러 날에 걸친 일정은 하루 시간표에 넣을 수 없어 블록을 만들지 않습니다.
 */

/** 카테고리 → 일정 색 (화면의 CATEGORY_INFO 와 같은 대응) */
export const CATEGORY_COLOR: Record<string, string> = {
  work: 'blue',
  study: 'orange',
  health: 'aqua',
  personal: 'yellow',
  meeting: 'magenta',
  rest: 'green',
}
export const categoryFromColor = (color: unknown) => Object.entries(CATEGORY_COLOR).find(([, c]) => c === color)?.[0] ?? 'personal'

/** body.category 검증 (없으면 undefined) */
export const pickCategory = (v: unknown): string | undefined =>
  v === undefined ? undefined : (f.oneOf(CATEGORIES)(v, 'category') as string)

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const toTime = (m: number) => (m >= 1440 ? '23:59' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)

interface EventLike {
  id: string
  title: string
  start_at: string
  end_at: string
  all_day: number
  color: string
  series_id?: string | null
}

/** 일정 → 블록 시간 (블록으로 만들 수 없으면 null) */
export function blockTimeFromEvent(e: Pick<EventLike, 'start_at' | 'end_at' | 'all_day'>) {
  if (e.all_day) return null
  const date = e.start_at.slice(0, 10)
  if (e.end_at.slice(0, 10) !== date) return null
  const start_min = toMin(e.start_at.slice(11))
  const end_min = toMin(e.end_at.slice(11))
  if (end_min <= start_min) return null
  return { date, start_min, end_min }
}

/** 블록 → 일정 시간 */
export const eventTimeFromBlock = (date: string, start_min: number, end_min: number) => ({
  start_at: `${date}T${toTime(start_min)}`,
  end_at: `${date}T${toTime(end_min)}`,
})

async function assertRoom(db: D1Database, table: string, uid: string, adding: number, max: number, what: string) {
  const n = (await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).bind(uid).first<number>('n')) ?? 0
  if (n + adding > max)
    throw new HttpError(429, `저장 가능한 최대 ${what} 수(${max.toLocaleString()}개)에 도달했습니다. 오래된 항목을 정리해 주세요.`)
}
export const assertEventRoom = (db: D1Database, uid: string, n = 1) => assertRoom(db, 'events', uid, n, eventResource.maxRows, '일정')
export const assertBlockRoom = (db: D1Database, uid: string, n = 1) => assertRoom(db, 'time_blocks', uid, n, blockResource.maxRows, '블록')

export const insertBlockStmt = (db: D1Database) =>
  db.prepare(
    `INSERT INTO time_blocks (id, user_id, date, start_min, end_min, title, category, task_id, series_id, event_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
export const insertEventStmt = (db: D1Database) =>
  db.prepare(
    `INSERT INTO events (id, user_id, title, description, start_at, end_at, all_day, color, series_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

/**
 * 일정이 바뀐 뒤 연결된 블록을 맞춤
 * - 블록으로 만들 수 있으면: 있으면 수정, 없으면 새로 만들어 연결
 * - 만들 수 없으면(종일 · 여러 날): 연결된 블록 삭제
 */
export async function syncBlockForEvent(db: D1Database, uid: string, ev: EventLike, category?: string) {
  const time = blockTimeFromEvent(ev)
  const existing = await db
    .prepare('SELECT id, category FROM time_blocks WHERE user_id = ? AND event_id = ?')
    .bind(uid, ev.id)
    .first<{ id: string; category: string }>()
  if (!time) {
    if (existing) await db.prepare('DELETE FROM time_blocks WHERE id = ?').bind(existing.id).run()
    return
  }
  const cat = category ?? existing?.category ?? categoryFromColor(ev.color)
  if (existing) {
    await db
      .prepare('UPDATE time_blocks SET date = ?, start_min = ?, end_min = ?, title = ?, category = ? WHERE id = ?')
      .bind(time.date, time.start_min, time.end_min, ev.title, cat, existing.id)
      .run()
  } else {
    await assertBlockRoom(db, uid)
    await insertBlockStmt(db)
      .bind(crypto.randomUUID(), uid, time.date, time.start_min, time.end_min, ev.title, cat, null, ev.series_id ?? null, ev.id)
      .run()
  }
}

/* ------------------------------------------------------------------------
   반복(series) 일괄 처리용 SQL — 수백 개도 한 문장으로 처리해 배치 한도와 무관하게 원자적으로 실행
------------------------------------------------------------------------ */
const minExpr = (col: string) => `(CAST(substr(${col}, 12, 2) AS INTEGER) * 60 + CAST(substr(${col}, 15, 2) AS INTEGER))`
const colorToCategorySql = `CASE e.color ${Object.entries(CATEGORY_COLOR)
  .map(([cat, color]) => `WHEN '${color}' THEN '${cat}'`)
  .join(' ')} ELSE 'personal' END`
/** 블록으로 만들 수 있는 일정 조건 (하루 안의 시간 일정) */
const linkableSql = `e.all_day = 0 AND substr(e.start_at, 1, 10) = substr(e.end_at, 1, 10) AND e.end_at > e.start_at`

/** 반복 일정 중 아직 블록이 없는(만들 수 있는) 일정마다 연결된 블록 생성 */
export const insertBlocksForEventSeries = (db: D1Database, uid: string, seriesId: string, category?: string) =>
  db
    .prepare(
      `INSERT INTO time_blocks (id, user_id, date, start_min, end_min, title, category, task_id, series_id, event_id)
       SELECT lower(hex(randomblob(16))), e.user_id, substr(e.start_at, 1, 10), ${minExpr('e.start_at')}, ${minExpr('e.end_at')},
              e.title, COALESCE(?, ${colorToCategorySql}), NULL, e.series_id, e.id
         FROM events e
        WHERE e.user_id = ? AND e.series_id = ? AND ${linkableSql}
          AND NOT EXISTS (SELECT 1 FROM time_blocks b WHERE b.event_id = e.id)`,
    )
    .bind(category ?? null, uid, seriesId)

/** 반복 일정이 바뀐 뒤: 블록으로 둘 수 없게 된 일정의 블록 삭제 + 나머지 블록 제목 · 시간 · 카테고리 맞춤 */
export const syncBlocksForEventSeries = (db: D1Database, uid: string, seriesId: string, category?: string) => [
  db
    .prepare(
      `DELETE FROM time_blocks WHERE user_id = ? AND event_id IN
         (SELECT e.id FROM events e WHERE e.user_id = ? AND e.series_id = ? AND NOT (${linkableSql}))`,
    )
    .bind(uid, uid, seriesId),
  db
    .prepare(
      `UPDATE time_blocks SET
         title = (SELECT e.title FROM events e WHERE e.id = time_blocks.event_id),
         start_min = (SELECT ${minExpr('e.start_at')} FROM events e WHERE e.id = time_blocks.event_id),
         end_min = (SELECT ${minExpr('e.end_at')} FROM events e WHERE e.id = time_blocks.event_id),
         category = COALESCE(?, category)
       WHERE user_id = ? AND event_id IN (SELECT id FROM events WHERE user_id = ? AND series_id = ?)`,
    )
    .bind(category ?? null, uid, uid, seriesId),
  insertBlocksForEventSeries(db, uid, seriesId, category),
]

/** 반복 블록이 바뀐 뒤: 연결된 일정의 제목 · 시간 · 색 맞춤 */
export const syncEventsForBlockSeries = (db: D1Database, uid: string, seriesId: string) =>
  db
    .prepare(
      `UPDATE events SET
         title = (SELECT b.title FROM time_blocks b WHERE b.event_id = events.id),
         start_at = (SELECT b.date || 'T' || printf('%02d:%02d', b.start_min / 60, b.start_min % 60) FROM time_blocks b WHERE b.event_id = events.id),
         end_at = (SELECT b.date || 'T' || CASE WHEN b.end_min >= 1440 THEN '23:59' ELSE printf('%02d:%02d', b.end_min / 60, b.end_min % 60) END
                     FROM time_blocks b WHERE b.event_id = events.id),
         all_day = 0,
         color = (SELECT CASE b.category ${Object.entries(CATEGORY_COLOR)
           .map(([cat, color]) => `WHEN '${cat}' THEN '${color}'`)
           .join(' ')} ELSE 'yellow' END FROM time_blocks b WHERE b.event_id = events.id)
       WHERE user_id = ? AND id IN (SELECT event_id FROM time_blocks WHERE user_id = ? AND series_id = ? AND event_id IS NOT NULL)`,
    )
    .bind(uid, uid, seriesId)

/** 반복 블록 중 아직 일정이 없는 블록마다 연결된 일정 생성 (일정 id = 새로 만든 값, 블록에 연결) */
export const insertEventsForBlockSeries = (db: D1Database, uid: string, seriesId: string) => [
  // 블록 id를 그대로 일정 id로 쓰면 한 문장으로 만들고 연결까지 할 수 있음 (서로 다른 표라 충돌 없음)
  db
    .prepare(
      `INSERT INTO events (id, user_id, title, description, start_at, end_at, all_day, color, series_id)
       SELECT b.id, b.user_id, b.title, '',
              b.date || 'T' || printf('%02d:%02d', b.start_min / 60, b.start_min % 60),
              b.date || 'T' || CASE WHEN b.end_min >= 1440 THEN '23:59' ELSE printf('%02d:%02d', b.end_min / 60, b.end_min % 60) END,
              0,
              CASE b.category ${Object.entries(CATEGORY_COLOR)
                .map(([cat, color]) => `WHEN '${cat}' THEN '${color}'`)
                .join(' ')} ELSE 'yellow' END,
              b.series_id
         FROM time_blocks b
        WHERE b.user_id = ? AND b.series_id = ? AND b.event_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM events x WHERE x.id = b.id)`,
    )
    .bind(uid, seriesId),
  db
    .prepare(
      `UPDATE time_blocks SET event_id = id
        WHERE user_id = ? AND series_id = ? AND event_id IS NULL AND EXISTS (SELECT 1 FROM events x WHERE x.id = time_blocks.id)`,
    )
    .bind(uid, seriesId),
]
