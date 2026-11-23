import type { Handler } from '../_lib/env'
import { json, requireDate } from '../_lib/http'

/** GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&today=YYYY-MM-DD */
export const onRequestGet: Handler = async ({ env, request, data }) => {
  const url = new URL(request.url)
  const from = requireDate(url.searchParams.get('from'), 'from')
  const to = requireDate(url.searchParams.get('to'), 'to')
  const today = requireDate(url.searchParams.get('today'), 'today')
  const uid = data.user.id
  const db = env.DB

  const [completedByDay, due, open, blocksByCategory, blocksByDay, events] = await db.batch([
    db
      .prepare(
        `SELECT substr(completed_at, 1, 10) AS date, COUNT(*) AS count FROM tasks
          WHERE user_id = ? AND done = 1 AND completed_at BETWEEN ? AND ?
          GROUP BY date ORDER BY date`,
      )
      .bind(uid, `${from}T00:00`, `${to}T23:59`),
    db
      .prepare(
        `SELECT COUNT(*) AS total, COALESCE(SUM(done), 0) AS done FROM tasks
          WHERE user_id = ? AND due_date BETWEEN ? AND ?`,
      )
      .bind(uid, from, to),
    db
      .prepare(
        `SELECT COUNT(*) AS open, COALESCE(SUM(due_date < ?), 0) AS overdue FROM tasks
          WHERE user_id = ? AND done = 0`,
      )
      .bind(today, uid),
    db
      .prepare(
        `SELECT category, SUM(end_min - start_min) AS minutes FROM time_blocks
          WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY category ORDER BY minutes DESC`,
      )
      .bind(uid, from, to),
    db
      .prepare(
        `SELECT date, SUM(end_min - start_min) AS minutes FROM time_blocks
          WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
      )
      .bind(uid, from, to),
    db
      .prepare(`SELECT COUNT(*) AS count FROM events WHERE user_id = ? AND start_at BETWEEN ? AND ?`)
      .bind(uid, `${from}T00:00`, `${to}T23:59`),
  ])

  const dueRow = due.results[0] as { total: number; done: number }
  const openRow = open.results[0] as { open: number; overdue: number }
  return json({
    completedByDay: completedByDay.results,
    dueTotal: dueRow.total,
    dueDone: dueRow.done,
    openTasks: openRow.open,
    overdueTasks: openRow.overdue,
    blocksByCategory: blocksByCategory.results,
    blocksByDay: blocksByDay.results,
    eventCount: (events.results[0] as { count: number }).count,
  })
}
