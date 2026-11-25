import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, COLOR_HEX, type CalendarEvent } from '../lib/api'
import { fmt, parseDate, toDateStr, todayStr } from '../lib/date'
import { ChevronLeft, ChevronRight } from './Icons'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 일정 추가 · 수정 창 왼쪽의 달력 (PC 전용)
 * - 날짜를 누르면 onPick
 * - 선택 기간(rangeStart~rangeEnd) 칠하기, marked(반복으로 만들어질 날짜) 표시
 * - 기존 일정이 있는 날에 점, 아래에 선택한 날의 기존 일정 목록
 */
export function EventCalendarPanel({
  focus,
  rangeStart,
  rangeEnd,
  marked,
  excludeId,
  onPick,
  children,
}: {
  /** 달력이 보여줄 기준 날짜 (선택한 날) */
  focus: string
  rangeStart: string
  rangeEnd: string
  marked?: Set<string>
  /** 수정 중인 일정 (기존 일정 목록에서 제외) */
  excludeId?: string
  onPick: (date: string) => void
  /** 달력 아래 추가 영역 */
  children?: ReactNode
}) {
  const [month, setMonth] = useState(() => startOfMonth(parseDate(focus)))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const today = todayStr()

  // 다른 곳(날짜 버튼)에서 날짜를 바꾸면 그 달로 이동
  useEffect(() => {
    const d = parseDate(focus)
    setMonth((m) => (isSameMonth(d, m) ? m : startOfMonth(d)))
  }, [focus])

  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) }), [month])
  const from = toDateStr(days[0])
  const to = toDateStr(days[days.length - 1])

  useEffect(() => {
    let alive = true
    api
      .get<CalendarEvent[]>(`/events?from=${from}&to=${to}`)
      .then((e) => alive && setEvents(e))
      .catch(() => alive && setEvents([]))
    return () => {
      alive = false
    }
  }, [from, to])

  const busy = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) {
      if (e.id === excludeId) continue
      for (let d = parseDate(e.start_at); toDateStr(d) <= e.end_at.slice(0, 10); d = addDays(d, 1)) set.add(toDateStr(d))
    }
    return set
  }, [events, excludeId])

  const dayEvents = events
    .filter((e) => e.id !== excludeId && e.start_at.slice(0, 10) <= focus && e.end_at.slice(0, 10) >= focus)
    .sort((a, b) => b.all_day - a.all_day || a.start_at.localeCompare(b.start_at))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="btn-ghost btn-icon min-h-8 rounded-full"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="이전 달"
        >
          <ChevronLeft />
        </button>
        <span className="text-[15px] font-bold">{fmt(month, 'yyyy년 M월')}</span>
        <button
          type="button"
          className="btn-ghost btn-icon min-h-8 rounded-full"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="다음 달"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-semibold">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`pb-1 ${i === 0 ? 'text-sunday' : 'text-ink-muted'}`}>
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const ds = toDateStr(d)
          if (!isSameMonth(d, month)) return <div key={ds} />
          const inRange = ds >= rangeStart && ds <= rangeEnd
          const isEdge = ds === rangeStart || ds === rangeEnd
          const isMarked = marked?.has(ds)
          const strong = marked ? isMarked : isEdge
          return (
            <div
              key={ds}
              className={`py-0.5 ${inRange && !marked ? 'bg-brand-soft' : ''} ${ds === rangeStart ? 'rounded-l-full' : ''} ${ds === rangeEnd ? 'rounded-r-full' : ''}`}
            >
              <button
                type="button"
                onClick={() => onPick(ds)}
                aria-label={fmt(d, 'M월 d일 (EEE)')}
                aria-pressed={strong}
                className={`relative mx-auto grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[13px] transition ${
                  strong
                    ? 'bg-brand font-bold text-on-brand'
                    : marked && inRange
                      ? 'font-medium text-ink ring-1 ring-brand-light ring-inset hover:bg-brand-soft'
                      : ds === today
                        ? 'font-bold text-brand-ink ring-2 ring-brand-accent ring-inset hover:bg-brand-soft'
                        : `font-medium hover:bg-surface-hover ${i % 7 === 0 ? 'text-sunday' : 'text-ink'}`
                }`}
              >
                {d.getDate()}
                {busy.has(ds) && (
                  <span
                    className={`absolute bottom-0.5 h-1 w-1 rounded-full ${strong ? 'bg-on-brand' : 'bg-point-orange'}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          )
        })}
      </div>

      {children}

      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold text-ink-muted">{fmt(parseDate(focus), 'M월 d일 (EEE)')}의 다른 일정</p>
        {dayEvents.length === 0 ? (
          <p className="text-xs text-ink-subtle">일정이 없어요</p>
        ) : (
          <ul className="space-y-1.5">
            {dayEvents.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR_HEX[e.color] }} aria-hidden="true" />
                <span className="w-[5.5rem] shrink-0 whitespace-nowrap text-ink-muted tabular-nums">
                  {e.all_day ? '종일' : `${e.start_at.slice(11)}–${e.end_at.slice(11)}`}
                </span>
                <span className="truncate font-medium">{e.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
