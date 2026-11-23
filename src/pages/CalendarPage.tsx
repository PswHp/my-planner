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
        <button className="btn-ghost px-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="이전 달">
          <ChevronLeft />
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            setMonth(startOfMonth(new Date()))
            setSelected(todayStr())
          }}
        >
          오늘
        </button>
        <button className="btn-ghost px-2" onClick={() => setMonth(addMonths(month, 1))} aria-label="다음 달">
          <ChevronRight />
        </button>
        <button className="btn-primary" onClick={() => openNew(selected)}>
          <PlusIcon /> 일정
        </button>
      </PageHeader>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#b42f2f]">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* 월간 그리드 */}
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-stone-100 text-center text-xs font-medium text-stone-500">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`py-2 ${i === 0 ? 'text-[#c23b3b]' : i === 6 ? 'text-[#1c5cab]' : ''}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const ds = toDateStr(d)
              const items = byDay.get(ds)
              const shown = items?.events.slice(0, 3) ?? []
              const more = (items?.events.length ?? 0) - shown.length
              const dueCount = items?.tasks.filter((t) => !t.done).length ?? 0
              const isSelected = ds === selected
              return (
                <button
                  key={ds}
                  onClick={() => setSelected(ds)}
                  onDoubleClick={() => openNew(ds)}
                  className={`flex min-h-20 cursor-pointer flex-col gap-0.5 border-r border-b border-stone-100 p-1 text-left transition md:min-h-28 md:p-1.5 ${
                    isSelected ? 'bg-c-blue/5' : 'hover:bg-stone-50'
                  } ${isSameMonth(d, month) ? '' : 'opacity-40'}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs font-medium ${
                        ds === today ? 'bg-c-blue text-white' : isSelected ? 'text-[#1c5cab]' : ''
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {dueCount > 0 && (
                      <span className="rounded bg-stone-100 px-1 text-[10px] text-stone-600" title={`마감 할 일 ${dueCount}개`}>
                        ✓{dueCount}
                      </span>
                    )}
                  </div>
                  {shown.map((ev) => (
                    <div
                      key={ev.id}
                      className="truncate rounded px-1 py-px text-[11px] leading-4 font-medium text-white"
                      style={{ background: COLOR_HEX[ev.color] }}
                    >
                      <span className="hidden md:inline">{!ev.all_day && ev.start_at.slice(0, 10) === ds ? `${ev.start_at.slice(11)} ` : ''}</span>
                      {ev.title}
                    </div>
                  ))}
                  {more > 0 && <div className="px-1 text-[10px] text-stone-500">+{more}개</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* 선택한 날짜 상세: 일정 + 할 일 */}
        <div className="h-fit space-y-4">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">
              {fmt(parseDate(selected), 'M월 d일 (EEE)')} <span className="text-sm font-normal text-stone-500">일정</span>
            </h2>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => openNew(selected)}>
              <PlusIcon /> 추가
            </button>
          </div>
          {selectedItems.events.length === 0 && <p className="py-4 text-center text-sm text-stone-400">일정이 없습니다</p>}
          <ul className="space-y-2">
            {selectedItems.events.map((ev) => (
              <li key={ev.id}>
                <button
                  onClick={() => setEditing(ev)}
                  className="flex w-full cursor-pointer gap-3 rounded-lg p-2 text-left hover:bg-stone-50"
                >
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: COLOR_HEX[ev.color] }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{ev.title}</span>
                    <span className="block text-xs text-stone-500">{eventTimeLabel(ev)}</span>
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
        <h2 className="font-semibold">
          할 일 <span className="text-sm font-normal text-stone-500">{tasks.length ? `${openCount}/${tasks.length}` : ''}</span>
        </h2>
        <Link to="/tasks" className="text-xs text-stone-500 hover:underline">
          전체 보기
        </Link>
      </div>

      {tasks.length === 0 && <p className="py-3 text-center text-sm text-stone-400">이 날 마감인 할 일이 없습니다</p>}
      <ul className="space-y-1">
        {tasks.map((t) => {
          const overdue = !t.done && !!t.due_date && t.due_date < today
          return (
            <li key={t.id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={!!t.done}
                  onChange={() => onToggle(t)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-c-blue"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${t.done ? 'text-stone-400 line-through' : ''}`}>{t.title}</span>
                  {overdue && (
                    <span className="text-xs text-[#b42f2f]">기한 지남 · {fmt(parseDate(t.due_date!), 'M/d')}</span>
                  )}
                </span>
                {t.priority === 3 && !t.done && (
                  <span className="rounded bg-red-50 px-1.5 py-px text-[11px] font-medium text-[#b42f2f]">높음</span>
                )}
              </label>
            </li>
          )
        })}
      </ul>

      <form onSubmit={add} className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
        <input
          className="input py-1.5"
          placeholder={`${fmt(parseDate(date), 'M/d')} 할 일 추가…`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="할 일 추가"
        />
        <button className="btn-primary shrink-0 py-1.5" disabled={busy || !title.trim()}>
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
        {error && <p className="text-sm text-[#b42f2f]">{error}</p>}
      </form>
    </Modal>
    </>
  )
}
