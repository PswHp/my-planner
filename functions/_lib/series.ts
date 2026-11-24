import { f } from './crud'
import { HttpError } from './http'
import { COLORS } from './resources'

/** 한 번에 만들 수 있는 최대 일정 수 · 최대 기간(일) */
export const SERIES_MAX_COUNT = 366
export const SERIES_MAX_SPAN_DAYS = 366

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export interface SeriesFields {
  title: string
  description: string
  color: string
  all_day: 0 | 1
  start_time: string
  end_time: string
}

/** 반복 일정의 공통 내용(제목 · 메모 · 색 · 종일 · 시간) 검증 */
export function pickSeriesFields(body: Record<string, unknown>): SeriesFields {
  const title = f.text(200, true)(body.title, 'title') as string
  const description = body.description === undefined ? '' : (f.text(2000)(body.description, 'description') as string)
  const color = body.color === undefined ? 'blue' : (f.oneOf(COLORS)(body.color, 'color') as string)
  const all_day = f.bool()(body.all_day ?? false, 'all_day') as 0 | 1
  let start_time = '00:00'
  let end_time = '23:59'
  if (!all_day) {
    if (typeof body.start_time !== 'string' || !TIME_RE.test(body.start_time))
      throw new HttpError(400, 'start_time: HH:mm 형식이어야 합니다.')
    if (typeof body.end_time !== 'string' || !TIME_RE.test(body.end_time)) throw new HttpError(400, 'end_time: HH:mm 형식이어야 합니다.')
    if (body.end_time < body.start_time) throw new HttpError(400, '종료 시각은 시작 시각보다 뒤여야 합니다.')
    start_time = body.start_time
    end_time = body.end_time
  }
  return { title, description, color, all_day, start_time, end_time }
}

/** from~until 기간에서 선택한 요일(0=일 ~ 6=토)에 해당하는 날짜 목록 */
export function seriesDates(fromRaw: unknown, untilRaw: unknown, daysRaw: unknown): string[] {
  const from = f.date()(fromRaw, 'from') as string
  const until = f.date()(untilRaw, 'until') as string
  if (until < from) throw new HttpError(400, '반복 종료일은 시작일보다 뒤여야 합니다.')
  if (!Array.isArray(daysRaw) || daysRaw.length === 0 || daysRaw.length > 7)
    throw new HttpError(400, 'days: 요일을 하나 이상 선택해 주세요.')
  const days = new Set<number>()
  for (const d of daysRaw) {
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6)
      throw new HttpError(400, 'days: 0(일)~6(토) 사이의 정수여야 합니다.')
    days.add(d)
  }

  // 시간대 영향을 받지 않도록 UTC 날짜로 계산
  const toUtc = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  const start = toUtc(from)
  const end = toUtc(until)
  if ((end - start) / 86_400_000 + 1 > SERIES_MAX_SPAN_DAYS)
    throw new HttpError(400, `반복 기간은 최대 ${SERIES_MAX_SPAN_DAYS}일까지 설정할 수 있습니다.`)

  const out: string[] = []
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t)
    if (days.has(d.getUTCDay())) out.push(d.toISOString().slice(0, 10))
  }
  if (out.length === 0) throw new HttpError(400, '선택한 기간과 요일에 해당하는 날짜가 없습니다.')
  if (out.length > SERIES_MAX_COUNT) throw new HttpError(400, `한 번에 최대 ${SERIES_MAX_COUNT}개까지 만들 수 있습니다.`)
  return out
}
