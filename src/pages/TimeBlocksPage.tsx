import { addDays } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useDataChanged } from '../lib/quickAdd'
import { useSearchParams } from 'react-router'
import { EventModal } from '../components/EventModal'
import { DateField } from '../components/DateTimePicker'
import { ChevronLeft, ChevronRight, PlusIcon } from '../components/Icons'
import { BlockModal, type Draft } from '../components/BlockModal'
import { PageHeader } from '../components/Layout'
import { api, CATEGORIES, CATEGORY_INFO, COLOR_HEX, type CalendarEvent, type Category, type Task, type TimeBlock } from '../lib/api'
import { layoutBlocks } from '../lib/timeline'
import { fmt, formatDuration, minToTime, parseDate, timeToMin, toDateStr, todayStr } from '../lib/date'

const HOUR_PX = 56
const SNAP = 15
const PX_PER_MIN = HOUR_PX / 60

/** 시간표에 함께 보여줄 그날의 일정 (분 단위로 변환, 하루 범위로 자름) */
interface DayEvent {
  event: CalendarEvent
  start_min: number
  end_min: number
}

export default function TimeBlocksPage() {
  // 일정 관리 화면에서 넘어올 때 ?date=YYYY-MM-DD 로 그 날짜를 엶
  const [searchParams] = useSearchParams()
  const [date, setDate] = useState(() => {
    const d = searchParams.get('date')
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayStr()
  })
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    Promise.all([
      api.get<TimeBlock[]>(`/blocks?from=${date}&to=${date}`),
      api.get<Task[]>('/tasks'),
      api.get<CalendarEvent[]>(`/events?from=${date}&to=${date}`),
    ])
      .then(([b, t, e]) => {
        setBlocks(b)
        setTasks(t)
        setEvents(e)
        setError(null)
      })
      .catch((e) => setError(e.message))
  }, [date])
  useEffect(load, [load])
  useDataChanged(load) // 상단 바에서 추가하면 다시 불러오기

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // 처음 열 때 오전 7시 근처로 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7 * HOUR_PX - 8 })
  }, [])

  const minFromPointer = (e: PointerEvent) => {
    const rect = gridRef.current!.getBoundingClientRect()
    const raw = (e.clientY - rect.top) / PX_PER_MIN
    return Math.max(0, Math.min(1440, Math.round(raw / SNAP) * SNAP))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return
    const m = Math.min(minFromPointer(e), 1440 - SNAP)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ anchor: m, current: m + SNAP * 2 })
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag) setDrag({ ...drag, current: minFromPointer(e) })
  }
  const onPointerUp = () => {
    if (!drag) return
    let start = Math.min(drag.anchor, drag.current)
    let end = Math.max(drag.anchor, drag.current)
    if (end - start < SNAP) {
      // 클릭만 한 경우 1시간 블록
      start = drag.anchor
      end = Math.min(1440, start + 60)
    }
    setDrag(null)
    setDraft({ date, start_min: start, end_min: end, title: '', category: 'work', task_id: null })
  }

  // 그날의 시간 일정 (종일 일정은 위쪽 띠에 따로 표시)
  const dayEvents = useMemo<DayEvent[]>(
    () =>
      events
        .filter((e) => !e.all_day && !e.block_category) // 연결된 블록이 있는 일정은 블록으로 이미 보임
        .map((e) => {
          const start_min = e.start_at.slice(0, 10) < date ? 0 : timeToMin(e.start_at.slice(11))
          const end_min = e.end_at.slice(0, 10) > date ? 1440 : timeToMin(e.end_at.slice(11))
          return { event: e, start_min, end_min: Math.max(end_min, start_min + SNAP) }
        }),
    [events, date],
  )
  const allDayEvents = events.filter((e) => e.all_day)
  const laid = useMemo(
    () =>
      layoutBlocks<{ start_min: number; end_min: number; block?: TimeBlock; ev?: DayEvent }>([
        ...blocks.map((b) => ({ start_min: b.start_min, end_min: b.end_min, block: b })),
        ...dayEvents.map((d) => ({ start_min: d.start_min, end_min: d.end_min, ev: d })),
      ]),
    [blocks, dayEvents],
  )
  const summary = useMemo(() => {
    const m = new Map<Category, number>()
    for (const b of blocks) m.set(b.category, (m.get(b.category) ?? 0) + b.end_min - b.start_min)
    return CATEGORIES.filter((c) => m.has(c)).map((c) => ({ category: c, minutes: m.get(c)! }))
  }, [blocks])
  const total = summary.reduce((s, x) => s + x.minutes, 0)
  const openTasks = tasks.filter((t) => !t.done)
  const isToday = date === todayStr()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const blockFromTask = (t: Task) => {
    const startBase = isToday ? Math.ceil(nowMin / SNAP) * SNAP : 9 * 60
    const start = Math.min(startBase, 1440 - 60)
    setDraft({ date, start_min: start, end_min: start + 60, title: t.title, category: 'work', task_id: t.id })
  }

  const shift = (days: number) => setDate(toDateStr(addDays(parseDate(date), days)))
  const dragRange = drag && { start: Math.min(drag.anchor, drag.current), end: Math.max(drag.anchor, drag.current) }

  return (
    <div>
      <PageHeader title={fmt(parseDate(date), 'M월 d일 (EEE)')} description={isToday ? '오늘의 시간 계획' : '타임 블록'}>
        <div className="flex items-center rounded-control border border-line bg-surface p-0.5 shadow-card">
          <button className="btn-ghost btn-icon min-h-9" onClick={() => shift(-1)} aria-label="이전 날">
            <ChevronLeft />
          </button>
          <button className="btn-ghost min-h-9 px-3" onClick={() => setDate(todayStr())}>
            오늘
          </button>
          <button className="btn-ghost btn-icon min-h-9" onClick={() => shift(1)} aria-label="다음 날">
            <ChevronRight />
          </button>
        </div>
        <div className="w-44">
          <DateField label="날짜 선택" value={date} onChange={setDate} />
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            const s = isToday ? Math.min(Math.ceil(nowMin / SNAP) * SNAP, 1380) : 540
            setDraft({ date, start_min: s, end_min: s + 60, title: '', category: 'work', task_id: null })
          }}
        >
          <PlusIcon /> 블록
        </button>
      </PageHeader>

      {error && <p className="alert-error mb-4">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-surface-muted px-4 py-2.5 text-xs text-ink-muted">
            <span aria-hidden="true">💡</span>빈 곳을 드래그해서 블록을 만들고, 블록을 누르면 수정합니다.
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-4 rounded-[3px] border-2 border-dashed border-ink-subtle" aria-hidden="true" />
              점선은 일정 관리의 일정이에요
            </span>
          </p>
          {allDayEvents.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2">
              <span className="text-xs font-semibold text-ink-muted">종일 일정</span>
              {allDayEvents.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEditingEvent(e)}
                  className="max-w-48 cursor-pointer truncate rounded-full border-2 border-dashed px-2.5 py-0.5 text-xs font-medium transition hover:brightness-95"
                  style={{
                    borderColor: COLOR_HEX[e.color],
                    background: `color-mix(in oklab, ${COLOR_HEX[e.color]} 10%, var(--color-surface))`,
                  }}
                >
                  {e.title}
                </button>
              ))}
            </div>
          )}
          <div ref={scrollRef} className="h-[65vh] overflow-y-auto">
            <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
              {/* 시간 눈금 */}
              <div className="w-14 shrink-0 select-none">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="relative text-right text-[11px] text-ink-subtle" style={{ height: HOUR_PX }}>
                    <span className="absolute -top-2 right-2">{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</span>
                  </div>
                ))}
              </div>
              {/* 그리드 */}
              <div
                ref={gridRef}
                className="relative flex-1 cursor-crosshair touch-none border-l border-line"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDrag(null)}
                style={{
                  backgroundImage: `linear-gradient(to bottom, var(--color-line) 1px, transparent 1px), linear-gradient(to bottom, var(--color-surface-muted) 1px, transparent 1px)`,
                  backgroundSize: `100% ${HOUR_PX}px, 100% ${HOUR_PX / 2}px`,
                }}
              >
                {laid.map(({ block: item, lane, lanes }) => {
                  if (item.ev) {
                    const { event: e, start_min, end_min } = item.ev
                    const color = COLOR_HEX[e.color]
                    const h = (end_min - start_min) * PX_PER_MIN
                    return (
                      <button
                        key={'ev-' + e.id}
                        type="button"
                        onClick={() => setEditingEvent(e)}
                        title="일정 — 누르면 일정을 수정해요"
                        className="absolute cursor-pointer overflow-hidden rounded-lg border-2 border-dashed px-2 py-1 text-left text-xs transition duration-150 hover:brightness-[0.97]"
                        style={{
                          top: start_min * PX_PER_MIN + 1,
                          height: h - 2,
                          left: `calc(${(lane / lanes) * 100}% + 4px)`,
                          width: `calc(${100 / lanes}% - 8px)`,
                          borderColor: color,
                          background: `color-mix(in oklab, ${color} 8%, var(--color-surface))`,
                        }}
                      >
                        <div className="flex items-center gap-1 truncate font-semibold text-ink">
                          <span className="shrink-0 rounded bg-surface-sunken px-1 text-[10px] font-bold text-ink-muted">일정</span>
                          <span className="truncate">{e.title}</span>
                        </div>
                        {h > 30 && (
                          <div className="truncate text-ink-muted">
                            {minToTime(start_min)}–{minToTime(end_min)}
                          </div>
                        )}
                      </button>
                    )
                  }
                  const b = item.block!
                  const color = COLOR_HEX[CATEGORY_INFO[b.category].color]
                  const height = (b.end_min - b.start_min) * PX_PER_MIN
                  return (
                    <button
                      key={b.id}
                      onClick={() => setDraft(b)}
                      className="absolute cursor-pointer overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs shadow-card transition duration-150 hover:shadow-raised hover:brightness-[0.98]"
                      style={{
                        top: b.start_min * PX_PER_MIN + 1,
                        height: height - 2,
                        left: `calc(${(lane / lanes) * 100}% + 4px)`,
                        width: `calc(${100 / lanes}% - 8px)`,
                        borderColor: color,
                        background: `color-mix(in oklab, ${color} 14%, var(--color-surface))`,
                      }}
                    >
                      <div className="truncate font-semibold text-ink">{b.title}</div>
                      {height > 30 && (
                        <div className="truncate text-ink-muted">
                          {minToTime(b.start_min)}–{minToTime(b.end_min)} · {CATEGORY_INFO[b.category].label}
                          {b.series_id && ' · ↻ 반복'}
                        </div>
                      )}
                    </button>
                  )
                })}

                {dragRange && (
                  <div
                    className="pointer-events-none absolute inset-x-1 rounded-lg border-2 border-dashed border-brand bg-brand-soft px-2 py-1 text-xs font-medium text-brand-ink"
                    style={{ top: dragRange.start * PX_PER_MIN, height: Math.max(dragRange.end - dragRange.start, SNAP) * PX_PER_MIN }}
                  >
                    {minToTime(dragRange.start)}–{minToTime(Math.max(dragRange.end, dragRange.start + SNAP))}
                  </div>
                )}

                {isToday && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowMin * PX_PER_MIN }}>
                    <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-danger" />
                    <span className="h-0.5 flex-1 bg-danger" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-4">
            <h2 className="section-title mb-3 flex items-baseline justify-between">
              하루 요약 <span className="text-sm font-normal text-ink-muted">{formatDuration(total)}</span>
            </h2>
            {summary.length === 0 ? (
              <p className="rounded-control bg-surface-muted py-5 text-center text-sm text-ink-subtle">계획한 블록이 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {summary.map((s) => (
                  <li key={s.category} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ background: COLOR_HEX[CATEGORY_INFO[s.category].color] }} />
                    <span className="flex-1">{CATEGORY_INFO[s.category].label}</span>
                    <span className="text-ink-muted tabular-nums">{formatDuration(s.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h2 className="section-title mb-1">할 일 → 블록</h2>
            <p className="mb-3 text-xs text-ink-muted">할 일을 누르면 그 할 일에 연결된 블록을 만듭니다.</p>
            {openTasks.length === 0 ? (
              <p className="rounded-control bg-surface-muted py-5 text-center text-sm text-ink-subtle">남은 할 일이 없습니다</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {openTasks.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => blockFromTask(t)}
                      className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-control px-2 py-2 text-left text-sm transition hover:bg-surface-hover"
                    >
                      <span className="text-ink-subtle">＋</span>
                      <span className="flex-1 truncate">{t.title}</span>
                      {t.due_date && <span className="text-xs text-ink-subtle">{fmt(parseDate(t.due_date), 'M/d')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {editingEvent && (
        <EventModal
          initial={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={() => {
            setEditingEvent(null)
            load()
          }}
        />
      )}

      {draft && (
        <BlockModal
          draft={draft}
          tasks={openTasks}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            load()
          }}
        />
      )}
    </div>
  )
}
