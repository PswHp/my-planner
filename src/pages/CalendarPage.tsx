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
import { ColorPicker } from '../components/ColorPicker'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ChevronLeft, ChevronRight, PlusIcon } from '../components/Icons'
import { PageHeader } from '../components/Layout'
import { Field, Modal } from '../components/Modal'
import { api, COLOR_HEX, type CalendarEvent, type Color, type Task } from '../lib/api'
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

  // 선택한 날짜가 마감인 할 일 (오늘을 선택했으면 기한 지난 미완료 할 일도 함께)
  const dayTasks = useMemo(() => {
    const list = tasks.filter(
      (t) => t.due_date === selected || (selected === today && !t.done && !!t.due_date && t.due_date < today),
    )
    return list.sort((a, b) => a.done - b.done || (a.due_date ?? '').localeCompare(b.due_date ?? '') || b.priority - a.priority)
  }, [tasks, selected, today])

  const toggleTask = async (t: Task) => {
    const done = !t.done
    const completed_at = done ? toDateTimeStr(new Date()) : null
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: done ? 1 : 0, completed_at } : x)))
    try {
      await api.patch(`/tasks/${t.id}`, { done, completed_at })
    } catch (e) {
      setError((e as Error).message)
      load()
    }
  }

  const openNew = (date: string) =>
    setEditing({ title: '', start_at: `${date}T09:00`, end_at: `${date}T10:00`, all_day: 0, color: 'blue', description: '' })

  return (
    <div>
      <PageHeader title={fmt(month, 'yyyy년 M월')}>
        <div className="flex items-center rounded-control border border-line bg-surface p-0.5 shadow-card">
          <button className="btn-ghost btn-icon min-h-9" onClick={() => setMonth(addMonths(month, -1))} aria-label="이전 달">
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
          <button className="btn-ghost btn-icon min-h-9" onClick={() => setMonth(addMonths(month, 1))} aria-label="다음 달">
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
                        isToday ? 'bg-brand text-white' : isSelected ? 'text-brand-ink' : 'text-ink'
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
                      <span className="hidden md:inline">{!ev.all_day && ev.start_at.slice(0, 10) === ds ? `${ev.start_at.slice(11)} ` : ''}</span>
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
              {fmt(parseDate(selected), 'M월 d일 (EEE)')} <span className="text-sm font-normal text-ink-muted">일정</span>
            </h2>
            <button className="btn-ghost btn-sm" onClick={() => openNew(selected)}>
              <PlusIcon /> 추가
            </button>
          </div>
          {selectedItems.events.length === 0 && (
            <p className="rounded-control bg-surface-muted py-5 text-center text-sm text-ink-subtle">일정이 없습니다</p>
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
                    <span className="block text-xs text-ink-muted">{eventTimeLabel(ev)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <DayTasks
          date={selected}
          tasks={dayTasks}
          onToggle={toggleTask}
          onAdded={load}
        />
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
  onToggle,
  onAdded,
}: {
  date: string
  tasks: Task[]
  onToggle: (t: Task) => void
  onAdded: () => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const today = todayStr()
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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">
          할 일 <span className="text-sm font-normal text-ink-muted">{tasks.length ? `${openCount}/${tasks.length}` : ''}</span>
        </h2>
        <Link to="/tasks" className="btn-ghost btn-sm">
          전체 보기
        </Link>
      </div>

      {tasks.length === 0 && (
        <p className="rounded-control bg-surface-muted py-5 text-center text-sm text-ink-subtle">이 날 마감인 할 일이 없습니다</p>
      )}
      <ul className="space-y-0.5">
        {tasks.map((t) => {
          const overdue = !t.done && !!t.due_date && t.due_date < today
          return (
            <li key={t.id}>
              <label className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-control px-2 py-2 transition hover:bg-surface-hover">
                <input
                  type="checkbox"
                  checked={!!t.done}
                  onChange={() => onToggle(t)}
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-brand"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${t.done ? 'text-ink-subtle line-through' : ''}`}>{t.title}</span>
                  {overdue && (
                    <span className="text-xs text-danger">기한 지남 · {fmt(parseDate(t.due_date!), 'M/d')}</span>
                  )}
                </span>
                {t.priority === 3 && !t.done && (
                  <span className="rounded bg-danger-soft px-1.5 py-px text-[11px] font-medium text-danger">높음</span>
                )}
              </label>
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
    </div>
  )
}

function eventTimeLabel(ev: CalendarEvent) {
  const sameDay = ev.start_at.slice(0, 10) === ev.end_at.slice(0, 10)
  if (ev.all_day) return sameDay ? '종일' : `종일 · ~${fmt(parseDate(ev.end_at), 'M/d')}`
  if (sameDay) return `${ev.start_at.slice(11)} – ${ev.end_at.slice(11)}`
  return `${ev.start_at.slice(11)} – ${fmt(parseDate(ev.end_at), 'M/d')} ${ev.end_at.slice(11)}`
}

function EventModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<CalendarEvent>
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [allDay, setAllDay] = useState(!!initial.all_day)
  const [startDate, setStartDate] = useState(initial.start_at!.slice(0, 10))
  const [startTime, setStartTime] = useState(initial.all_day ? '09:00' : initial.start_at!.slice(11))
  const [endDate, setEndDate] = useState(initial.end_at!.slice(0, 10))
  const [endTime, setEndTime] = useState(initial.all_day ? '10:00' : initial.end_at!.slice(11))
  const [color, setColor] = useState<Color>(initial.color ?? 'blue')
  const [description, setDescription] = useState(initial.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const start_at = `${startDate}T${allDay ? '00:00' : startTime}`
    const end_at = `${endDate}T${allDay ? '23:59' : endTime}`
    if (end_at < start_at) return setError('종료 시각이 시작 시각보다 빠릅니다.')
    setSaving(true)
    try {
      const body = { title, start_at, end_at, all_day: allDay, color, description }
      if (initial.id) await api.patch(`/events/${initial.id}`, body)
      else await api.post('/events', body)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const remove = async () => {
    if (!initial.id) return
    await api.del(`/events/${initial.id}`)
    onSaved()
  }

  return (
    <>
    {confirmingDelete && (
      <ConfirmDialog
        title="이 일정을 삭제할까요?"
        message={`${title.trim() || '제목 없음'} · ${fmt(parseDate(startDate), 'M월 d일 (EEE)')} ${allDay ? '종일' : startTime}`}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    )}
    <Modal
      title={initial.id ? '일정 수정' : '새 일정'}
      onClose={onClose}
      footer={
        <>
          {initial.id && (
            <button type="button" className="btn-danger" onClick={() => setConfirmingDelete(true)}>
              삭제
            </button>
          )}
          <button type="button" className="btn-ghost ml-auto" onClick={onClose}>
            취소
          </button>
          <button type="submit" form="event-form" className="btn-primary" disabled={saving || !title.trim()}>
            저장
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={save} className="space-y-4">
        <Field label="제목">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          종일
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="시작">
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (e.target.value > endDate) setEndDate(e.target.value)
              }}
              required
            />
          </Field>
          {!allDay && (
            <Field label="시작 시간">
              <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </Field>
          )}
          <Field label="종료">
            <input type="date" className="input" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required />
          </Field>
          {!allDay && (
            <Field label="종료 시간">
              <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </Field>
          )}
        </div>
        <Field label="색상">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <Field label="메모">
          <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <p className="alert-error">{error}</p>}
      </form>
    </Modal>
    </>
  )
}
