import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EventModal } from '../components/EventModal'
import { ChevronLeft, ChevronRight, PlusIcon, RepeatIcon } from '../components/Icons'
import { PageHeader } from '../components/Layout'
import { api, COLOR_HEX, type CalendarEvent, type Task } from '../lib/api'
import { fmt, parseDate, toDateStr, toDateTimeStr, todayStr } from '../lib/date'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(todayStr())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) }),
    [month],
  )
  const from = toDateStr(days[0])
  const to = toDateStr(days[days.length - 1])

  const load = useCallback(() => {
    Promise.all([api.get<CalendarEvent[]>(`/events?from=${from}&to=${to}`), api.get<Task[]>('/tasks')])
      .then(([e, t]) => {
        setEvents(e)
        setTasks(t)
        setError(null)
      })
      .catch((e) => setError(e.message))
  }, [from, to])

  useEffect(load, [load])

  // 날짜별로 일정/마감 할 일 묶기 (여러 날 일정은 걸친 모든 날에 표시)
  const byDay = useMemo(() => {
    const map = new Map<string, { events: CalendarEvent[]; tasks: Task[] }>()
    const get = (d: string) => {
      if (!map.has(d)) map.set(d, { events: [], tasks: [] })
      return map.get(d)!
    }
    for (const ev of events) {
      let d = parseDate(ev.start_at)
      const end = parseDate(ev.end_at)
      while (d <= end) {
        get(toDateStr(d)).events.push(ev)
        d = addDays(d, 1)
      }
    }
    for (const t of tasks) if (t.due_date) get(t.due_date).tasks.push(t)
    return map
  }, [events, tasks])

  const selectedItems = byDay.get(selected) ?? { events: [], tasks: [] }
  const today = todayStr()

  // 선택한 날짜가 마감인 할 일만 (그 이전에 기한이 지난 할 일은 표시하지 않음)
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.due_date === selected).sort((a, b) => a.done - b.done || b.priority - a.priority),
    [tasks, selected],
  )

  const openNew = (date: string) =>
    setEditing({
      title: '',
      start_at: `${date}T09:00`,
      end_at: `${date}T10:00`,
      all_day: 0,
      color: 'blue',
      description: '',
    })

  return (
    <div>
      <PageHeader title={fmt(month, 'yyyy년 M월')}>
        <div className="flex items-center rounded-control border border-line bg-surface p-0.5 shadow-card">
          <button
            className="btn-ghost btn-icon min-h-9"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="이전 달"
          >
            <ChevronLeft />
          </button>
          <button
            className="btn-ghost min-h-9 px-3"
            onClick={() => {
              setMonth(startOfMonth(new Date()))
              setSelected(todayStr())
            }}
          >
            오늘
          </button>
          <button
            className="btn-ghost btn-icon min-h-9"
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="다음 달"
          >
            <ChevronRight />
          </button>
        </div>
        <button className="btn-primary" onClick={() => openNew(selected)}>
          <PlusIcon /> 일정
        </button>
      </PageHeader>

      {error && <p className="alert-error mb-4">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* 월간 그리드 */}
        <div className="card self-start overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-muted text-center text-xs font-semibold text-ink-muted">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`py-2.5 ${i === 0 ? 'text-danger' : i === 6 ? 'text-c-blue' : ''}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, idx) => {
              const ds = toDateStr(d)
              const items = byDay.get(ds)
              const shown = items?.events.slice(0, 3) ?? []
              const more = (items?.events.length ?? 0) - shown.length
              const dueCount = items?.tasks.filter((t) => !t.done).length ?? 0
              const isSelected = ds === selected
              const isToday = ds === today
              return (
                <button
                  key={ds}
                  onClick={() => setSelected(ds)}
                  onDoubleClick={() => openNew(ds)}
                  aria-pressed={isSelected}
                  aria-label={`${fmt(d, 'M월 d일 EEEE')}${items?.events.length ? `, 일정 ${items.events.length}개` : ''}${dueCount ? `, 할 일 ${dueCount}개` : ''}`}
                  className={`relative flex min-h-[72px] cursor-pointer flex-col gap-0.5 border-b border-line p-1 text-left transition duration-150 md:min-h-28 md:p-1.5 ${
                    (idx + 1) % 7 ? 'border-r' : ''
                  } ${isSelected ? 'bg-brand-soft/70 shadow-[inset_0_0_0_2px_var(--color-brand)]' : 'hover:bg-surface-hover'} ${
                    isSameMonth(d, month) ? '' : 'opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                        isToday ? 'bg-brand text-on-brand' : isSelected ? 'text-brand-ink' : 'text-ink'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {dueCount > 0 && (
                      <span
                        className="flex items-center gap-0.5 rounded-full bg-brand-soft px-1.5 text-[10px] font-semibold text-brand-ink"
                        title={`마감 할 일 ${dueCount}개`}
                      >
                        ✓{dueCount}
                      </span>
                    )}
                  </div>
                  {shown.map((ev) => (
                    <div
                      key={ev.id}
                      className="truncate rounded-md px-1 py-px text-[11px] leading-4 font-medium text-white"
                      style={{ background: COLOR_HEX[ev.color] }}
                    >
                      <span className="hidden md:inline">
                        {!ev.all_day && ev.start_at.slice(0, 10) === ds ? `${ev.start_at.slice(11)} ` : ''}
                      </span>
                      {ev.title}
                    </div>
                  ))}
                  {more > 0 && <div className="px-1 text-[10px] text-ink-muted">+{more}개</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* 선택한 날짜 상세: 일정 + 할 일 */}
        <div className="h-fit space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">
                {fmt(parseDate(selected), 'M월 d일 (EEE)')}{' '}
                <span className="text-sm font-normal text-ink-muted">일정</span>
              </h2>
              <button className="btn-ghost btn-sm" onClick={() => openNew(selected)}>
                <PlusIcon /> 추가
              </button>
            </div>
            {selectedItems.events.length === 0 && (
              <p className="rounded-control bg-surface-muted py-5 text-center text-sm text-ink-subtle">
                일정이 없습니다
              </p>
            )}
            <ul className="space-y-1">
              {selectedItems.events.map((ev) => (
                <li key={ev.id}>
                  <button
                    onClick={() => setEditing(ev)}
                    className="flex w-full cursor-pointer gap-3 rounded-control p-2.5 text-left transition hover:bg-surface-hover"
                  >
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: COLOR_HEX[ev.color] }} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{ev.title}</span>
                      <span className="flex items-center gap-1 text-xs text-ink-muted">
                        {eventTimeLabel(ev)}
                        {ev.series_id && (
                          <span className="inline-flex items-center gap-0.5 text-brand-ink" title="반복 일정">
                            <RepeatIcon size={12} />
                            반복
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <DayTasks date={selected} tasks={dayTasks} onAdded={load} />
        </div>
      </div>

      {editing && (
        <EventModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function DayTasks({
  date,
  tasks,
  onAdded,
}: {
  date: string
  tasks: Task[]
  onAdded: () => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const openCount = tasks.filter((t) => !t.done).length

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      await api.post('/tasks', { title, due_date: date, created_at: toDateTimeStr(new Date()) })
      setTitle('')
      onAdded()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-4">
      <h2 className="section-title mb-3">
        할 일{' '}
        <span className="text-sm font-normal text-ink-muted">{tasks.length ? `${openCount}/${tasks.length}` : ''}</span>
      </h2>

      {tasks.length === 0 && (
        <p className="rounded-control bg-surface-muted py-5 text-center text-sm text-ink-subtle">
          이 날 마감인 할 일이 없습니다
        </p>
      )}
      <ul className="space-y-0.5">
        {tasks.map((t) => {
          return (
            <li key={t.id}>
              <div className="flex min-h-10 items-start gap-2.5 rounded-control px-2 py-2">
                <span
                  className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${t.done ? 'bg-line-strong' : 'bg-brand-accent'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${t.done ? 'text-ink-subtle line-through' : ''}`}>
                    {t.title}
                  </span>
                </span>
                {t.priority === 3 && !t.done && (
                  <span className="rounded bg-danger-soft px-1.5 py-px text-[11px] font-medium text-danger">높음</span>
                )}
                {t.done ? <span className="sr-only">(완료)</span> : null}
              </div>
            </li>
          )
        })}
      </ul>

      <form onSubmit={add} className="mt-3 flex gap-2 border-t border-line pt-3">
        <input
          className="input"
          placeholder={`${fmt(parseDate(date), 'M/d')} 할 일 추가…`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="할 일 추가"
        />
        <button className="btn-primary shrink-0" disabled={busy || !title.trim()}>
          추가
        </button>
      </form>

      <Link to="/tasks" className="mt-3 block text-right text-xs font-semibold text-brand-ink hover:underline">
        할 일 전체 보기 →
      </Link>
    </div>
  )
}

function eventTimeLabel(ev: CalendarEvent) {
  const sameDay = ev.start_at.slice(0, 10) === ev.end_at.slice(0, 10)
  if (ev.all_day) return sameDay ? '종일' : `종일 · ~${fmt(parseDate(ev.end_at), 'M/d')}`
  if (sameDay) return `${ev.start_at.slice(11)} – ${ev.end_at.slice(11)}`
  return `${ev.start_at.slice(11)} – ${fmt(parseDate(ev.end_at), 'M/d')} ${ev.end_at.slice(11)}`
}
