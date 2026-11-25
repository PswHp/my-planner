import { DATE_RE, DATETIME_RE, HttpError } from './http'

type DbValue = string | number | null

/** 필드 검증기: 올바르면 DB에 넣을 값을 반환하고, 아니면 HttpError를 던짐 */
export type Field = (value: unknown, name: string) => DbValue

const fail = (name: string, msg: string): never => {
  throw new HttpError(400, `${name}: ${msg}`)
}

export const f = {
  text:
    (max: number, required = false): Field =>
    (v, n) => {
      if (typeof v !== 'string') return fail(n, '문자열이어야 합니다.')
      const s = v.trim()
      if (required && !s) return fail(n, '비어 있을 수 없습니다.')
      if (s.length > max) return fail(n, `${max}자 이하여야 합니다.`)
      return s
    },
  date:
    (nullable = false): Field =>
    (v, n) => {
      if (v === null && nullable) return null
      if (typeof v !== 'string' || !DATE_RE.test(v)) return fail(n, 'YYYY-MM-DD 형식이어야 합니다.')
      return v
    },
  datetime:
    (nullable = false): Field =>
    (v, n) => {
      if (v === null && nullable) return null
      if (typeof v !== 'string' || !DATETIME_RE.test(v)) return fail(n, 'YYYY-MM-DDTHH:mm 형식이어야 합니다.')
      return v
    },
  int:
    (min: number, max: number): Field =>
    (v, n) => {
      if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return fail(n, `${min}~${max} 사이의 정수여야 합니다.`)
      return v
    },
  bool: (): Field => (v, n) => (typeof v === 'boolean' ? (v ? 1 : 0) : fail(n, 'true/false 여야 합니다.')),
  oneOf:
    (options: readonly string[]): Field =>
    (v, n) =>
      typeof v === 'string' && options.includes(v) ? v : fail(n, `${options.join(', ')} 중 하나여야 합니다.`),
  nullableId: (): Field => (v, n) => (v === null ? null : typeof v === 'string' && v.length <= 64 ? v : fail(n, '올바른 ID가 아닙니다.')),
}

export interface Resource {
  table: string
  fields: Record<string, Field>
  required: string[]
  /** 사용자 1명이 만들 수 있는 최대 행 수 (DB 남용 방지) */
  maxRows: number
}

/** body에서 허용된 필드만 검증해서 꺼냄 */
export function pick(res: Resource, body: Record<string, unknown>, partial: boolean): Record<string, DbValue> {
  const out: Record<string, DbValue> = {}
  for (const [name, validate] of Object.entries(res.fields)) {
    if (body[name] === undefined) continue
    out[name] = validate(body[name], name)
  }
  if (!partial) for (const name of res.required) if (out[name] === undefined) fail(name, '필수 항목입니다.')
  return out
}

export async function insertRow(db: D1Database, res: Resource, userId: string, values: Record<string, DbValue>) {
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM ${res.table} WHERE user_id = ?`).bind(userId).first<number>('n')
  if ((count ?? 0) >= res.maxRows)
    throw new HttpError(429, `저장 가능한 최대 개수(${res.maxRows.toLocaleString()}개)에 도달했습니다. 오래된 항목을 정리해 주세요.`)
  const row: Record<string, DbValue> = { id: crypto.randomUUID(), user_id: userId, ...values }
  const cols = Object.keys(row)
  await db
    .prepare(`INSERT INTO ${res.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .bind(...Object.values(row))
    .run()
  return db.prepare(`SELECT * FROM ${res.table} WHERE id = ?`).bind(row.id).first()
}

export async function getOwned<T = Record<string, unknown>>(db: D1Database, table: string, userId: string, id: string) {
  const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).bind(id, userId).first<T>()
  if (!row) throw new HttpError(404, '항목을 찾을 수 없습니다.')
  return row
}

export async function updateRow(db: D1Database, res: Resource, userId: string, id: string, values: Record<string, DbValue>) {
  const cols = Object.keys(values)
  if (cols.length === 0) throw new HttpError(400, '변경할 항목이 없습니다.')
  const result = await db
    .prepare(`UPDATE ${res.table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND user_id = ?`)
    .bind(...Object.values(values), id, userId)
    .run()
  if (!result.meta.changes) throw new HttpError(404, '항목을 찾을 수 없습니다.')
  return db.prepare(`SELECT * FROM ${res.table} WHERE id = ?`).bind(id).first()
}

export async function deleteRow(db: D1Database, table: string, userId: string, id: string) {
  const result = await db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).bind(id, userId).run()
  if (!result.meta.changes) throw new HttpError(404, '항목을 찾을 수 없습니다.')
}
