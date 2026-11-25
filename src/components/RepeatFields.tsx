import { addDays } from 'date-fns'
import { fmt, parseDate, toDateStr } from '../lib/date'

/**
 * 반복(기간 일괄 추가) 공용 도구 — 일정 · 타임 블록에서 함께 사용
 * 한도는 서버(functions/_lib/series.ts)와 같아야 합니다.
 */
export const MAX_REPEAT_COUNT = 366
export const MAX_REPEAT_SPAN_DAYS = 366

/** 요일 칩 순서: 월~일 (값은 0=일 ~ 6=토) */
const DAY_CHIPS: [number, string][] = [
  [1, '월'],
  [2, '화'],
  [3, '수'],
  [4, '목'],
  [5, '금'],
  [6, '토'],
  [0, '일'],
]
const PRESETS: [string, number[]][] = [
  ['매일', [0, 1, 2, 3, 4, 5, 6]],
  ['평일만', [1, 2, 3, 4, 5]],
  ['주말만', [0, 6]],
]

export const ALL_DAYS = () => new Set([0, 1, 2, 3, 4, 5, 6])

/** from~until 기간에서 선택한 요일에 해당하는 날짜들 (기간이 너무 길면 span만 반환) */
export function repeatDates(from: string, until: string, days: Set<number>): { dates: string[]; span: number } {
  if (until < from || days.size === 0) return { dates: [], span: 0 }
  const start = parseDate(from)
  const end = parseDate(until)
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (span > MAX_REPEAT_SPAN_DAYS) return { dates: [], span }
  const dates: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) if (days.has(d.getDay())) dates.push(toDateStr(d))
  return { dates, span }
}

/** 기간 · 요일 설정의 문제 안내 (문제가 없으면 null) */
export function repeatProblem(days: Set<number>, span: number, count: number): string | null {
  if (days.size === 0) return '요일을 하나 이상 골라 주세요.'
  if (span > MAX_REPEAT_SPAN_DAYS) return `반복 기간은 최대 ${MAX_REPEAT_SPAN_DAYS}일까지 설정할 수 있어요.`
  if (count === 0) return '선택한 기간과 요일에 해당하는 날짜가 없어요.'
  if (count > MAX_REPEAT_COUNT) return `한 번에 최대 ${MAX_REPEAT_COUNT}개까지 만들 수 있어요.`
  return null
}

/** 요일 선택: 매일 / 평일만 / 주말만 + 월~일 직접 선택 */
export function RepeatDaysPicker({ days, onChange }: { days: Set<number>; onChange: (days: Set<number>) => void }) {
  const presetActive = (list: number[]) => list.length === days.size && list.every((d) => days.has(d))
  const toggle = (d: number) => {
    const next = new Set(days)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    onChange(next)
  }
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-ink-muted">요일</p>
      <div className="segmented mb-2" role="tablist" aria-label="요일 빠른 선택">
        {PRESETS.map(([label, list]) => (
          <button key={label} type="button" role="tab" aria-selected={presetActive(list)} onClick={() => onChange(new Set(list))}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="요일 직접 선택">
        {DAY_CHIPS.map(([d, label]) => {
          const on = days.has(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(d)}
              className={`grid h-9 cursor-pointer place-items-center rounded-full text-sm font-semibold transition active:scale-95 ${
                on
                  ? 'bg-brand text-on-brand'
                  : `bg-field ring-1 ring-line hover:bg-surface-hover ${d === 0 ? 'text-sunday' : 'text-ink-muted'}`
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** '11월 24일 ~ 12월 21일 동안 20개의 ○○이 만들어져요' / 문제 안내 */
export function RepeatSummary({
  from,
  until,
  count,
  problem,
  noun,
}: {
  from: string
  until: string
  count: number
  problem: string | null
  noun: string
}) {
  return (
    <p
      className={`rounded-control px-3 py-2 text-sm font-medium ${problem ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand-ink'}`}
      aria-live="polite"
    >
      {problem ?? (
        <>
          {fmt(parseDate(from), 'M월 d일')} ~ {fmt(parseDate(until), 'M월 d일')} 동안 <b>{count}개</b>의 {noun}이 만들어져요
        </>
      )}
    </p>
  )
}
