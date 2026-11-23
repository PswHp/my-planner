import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { displayName } from '../components/Layout'
import {
  BarsIcon,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardIcon,
  HeartIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  ShirtIcon,
} from '../components/Icons'
import { BUSH, CAT, CLOUD, FLOWER, FLOWER_PINK, GRASS, HEART, MOUND, PixelArt, PixelStrip, SPROUT, TREE } from '../components/Pixel'
import { api, COLOR_HEX, type CalendarEvent, type Task, type User } from '../lib/api'
import { fmt, parseDate, toDateStr, toDateTimeStr, todayStr } from '../lib/date'
import { PREVIEW_PET } from '../lib/preview'
import { EventModal } from './CalendarPage'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 대시보드 — 기존 API(/events, /tasks)만 사용합니다.
 * '나의 동물' 카드만 디자인용 임시 데이터(PREVIEW_PET)이며, 나머지는 모두 실제 데이터입니다.
 */
export default function DashboardPage({ user }: { user: User }) {
  const today = todayStr()
  const [selected, setSelected] = useState(today)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null)

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(month),
        end: endOfWeek(endOfMonth(month)),
      }),
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

  /** 날짜 선택 — 다른 달이면 달력도 그 달로 이동 */
  const select = (d: string) => {
    setSelected(d)
    const date = parseDate(d)
    if (!isSameMonth(date, month)) setMonth(startOfMonth(date))
  }

  // 선택한 날이 마감인 할 일만 (기한 지난 할 일은 대시보드에 표시하지 않음)
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.due_date === selected).sort((a, b) => a.done - b.done || b.priority - a.priority),
    [tasks, selected],
  )

  // 선택한 날의 일정 (여러 날 일정 포함)
  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => e.start_at.slice(0, 10) <= selected && e.end_at.slice(0, 10) >= selected)
        .sort((a, b) => b.all_day - a.all_day || a.start_at.localeCompare(b.start_at)),
    [events, selected],
  )

  // 달력의 점 표시 (일정 또는 마감 할 일이 있는 날)
  const busyDays = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) {
      for (let d = parseDate(e.start_at); toDateStr(d) <= e.end_at.slice(0, 10); d = addDays(d, 1)) set.add(toDateStr(d))
    }
    for (const t of tasks) if (t.due_date) set.add(t.due_date)
    return set
  }, [events, tasks])

  // 이번 주 진행률 — 이번 주(일~토)가 마감인 할 일 중 완료 비율
  const week = useMemo(() => {
    const now = new Date()
    const start = toDateStr(startOfWeek(now))
    const end = toDateStr(endOfWeek(now))
    const inWeek = tasks.filter((t) => t.due_date && t.due_date >= start && t.due_date <= end)
    const done = inWeek.filter((t) => t.done).length
    return {
      done,
      total: inWeek.length,
      pct: inWeek.length ? Math.round((done / inWeek.length) * 100) : 0,
    }
  }, [tasks])

  // 연속 달성 — 할 일을 1개 이상 완료한 날이 며칠 연속인지 (오늘 아직 없으면 어제까지 기준)
  const streak = useMemo(() => {
    const doneDays = new Set(tasks.filter((t) => t.completed_at).map((t) => t.completed_at!.slice(0, 10)))
    let d = new Date()
    const doneToday = doneDays.has(toDateStr(d))
    if (!doneToday) d = addDays(d, -1)
    let count = 0
    while (doneDays.has(toDateStr(d))) {
      count++
      d = addDays(d, -1)
    }
    return { count, doneToday }
  }, [tasks])

  const openNewEvent = () =>
    setEditing({
      title: '',
      start_at: `${selected}T09:00`,
      end_at: `${selected}T10:00`,
      all_day: 0,
      color: 'green',
      description: '',
    })

  return (
    <div>
      <Greeting user={user} selected={selected} today={today} onSelect={select} />

      {error && <p className="alert-error mb-4">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-12">
        <PetCard className="md:col-span-2 xl:col-span-7" />

        <TodayTasks
          className="xl:col-span-5"
          date={selected}
          today={today}
          tasks={dayTasks}
        />

        <MiniCalendar
          className="max-md:order-last xl:col-span-4"
          month={month}
          days={days}
          selected={selected}
          today={today}
          busyDays={busyDays}
          onMonth={(m) => setMonth(m)}
          onSelect={select}
        />

        <TodaySchedule
          className="xl:col-span-4"
          date={selected}
          today={today}
          events={dayEvents}
          onAdd={openNewEvent}
          onOpen={setEditing}
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-1 md:gap-5 xl:col-span-4">
          <WeekProgress {...week} />
          <Streak {...streak} />
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

/* ---------------------------------------------------------------------------
   인사말 + 날짜 선택
--------------------------------------------------------------------------- */
function greetingFor(hour: number) {
  if (hour >= 5 && hour < 11) return '좋은 아침이에요'
  if (hour >= 11 && hour < 17) return '좋은 오후예요'
  if (hour >= 17 && hour < 22) return '좋은 저녁이에요'
  return '편안한 밤이에요'
}

function Greeting({ user, selected, today, onSelect }: { user: User; selected: string; today: string; onSelect: (d: string) => void }) {
  const shift = (n: number) => onSelect(toDateStr(addDays(parseDate(selected), n)))
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-[22px] font-extrabold tracking-tight md:text-[26px]">
          {greetingFor(new Date().getHours())}, {displayName(user)}님! <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">오늘도 계획한 일들을 하나씩 완성해볼까요?</p>
      </div>

      {/* 날짜 이동 — 날짜가 바뀌어도 크기가 변하지 않도록 고정 너비 + '오늘' 버튼은 항상 같은 자리 */}
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="flex min-w-0 flex-1 items-center justify-between rounded-full border border-line bg-field p-1 shadow-card sm:flex-none">
          <button className="btn-ghost btn-icon min-h-9 rounded-full" onClick={() => shift(-1)} aria-label="이전 날">
            <ChevronLeft />
          </button>
          <span
            className="flex min-h-9 items-center justify-center gap-2 px-1 text-[15px] font-semibold tabular-nums sm:w-[13.5rem]"
            aria-live="polite"
          >
            <span className="text-brand">
              <CalendarIcon />
            </span>
            {fmt(parseDate(selected), 'yyyy년 M월 d일 (EEE)')}
          </span>
          <button className="btn-ghost btn-icon min-h-9 rounded-full" onClick={() => shift(1)} aria-label="다음 날">
            <ChevronRight />
          </button>
        </div>
        <button
          className="btn-secondary h-11 shrink-0 rounded-full px-4 shadow-card"
          onClick={() => onSelect(today)}
          disabled={selected === today}
          title="오늘로 이동"
        >
          오늘
        </button>
      </div>
    </header>
  )
}

/* ---------------------------------------------------------------------------
   나의 동물 (디자인 미리보기 — 게임 로직 없음)
--------------------------------------------------------------------------- */
function PetCard({ className = '' }: { className?: string }) {
  const pet = PREVIEW_PET
  const pct = Math.round((pet.exp / pet.expMax) * 100)
  const soon = '준비 중이에요'
  const actions: [ReactNode, string][] = [
    [<ShirtIcon />, '꾸미기'],
    [<HeartIcon />, '교감하기'],
    [<InfoIcon />, '상세보기'],
  ]

  return (
    <section className={`card flex gap-3 p-3 sm:gap-4 ${className}`} aria-label="나의 동물 (미리보기)">
      {/* 장면 */}
      <div className="relative min-h-[210px] w-[42%] shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-b from-sky to-sky-end sm:min-h-[236px] sm:w-[46%]">
        <PixelArt sprite={CLOUD} scale={3} className="absolute top-4 left-[18%] opacity-90" />
        <PixelArt sprite={CLOUD} scale={2} className="absolute top-9 right-[12%] opacity-80" />
        <PixelArt sprite={TREE} scale={4} className="absolute bottom-[14px] -left-5 h-auto w-16 sm:-left-4 sm:w-24" />
        <PixelArt sprite={TREE} scale={3} className="absolute right-[-12px] bottom-[14px] hidden h-auto w-[72px] sm:block" />
        <PixelArt sprite={BUSH} scale={3} className="absolute right-[22%] bottom-[14px]" />
        <PixelArt sprite={FLOWER} scale={2} className="absolute bottom-[16px] left-[30%]" />
        <PixelArt sprite={FLOWER_PINK} scale={2} className="absolute right-[10%] bottom-[16px]" />
        <PixelStrip sprite={GRASS} scale={3} className="absolute inset-x-0 bottom-0" />

        <div className="absolute bottom-[12px] left-1/2 -translate-x-[42%]">
          <div className="absolute -top-10 -left-5 animate-bob-slow rounded-[10px] border-2 border-[#4a3b36] bg-white px-1.5 py-1 sm:-left-7">
            <PixelArt sprite={HEART} scale={2.5} />
            <span className="absolute -bottom-[7px] left-3 h-2.5 w-2.5 rotate-45 border-r-2 border-b-2 border-[#4a3b36] bg-white" />
          </div>
          <PixelArt sprite={CAT} scale={5} className="h-auto w-[84px] animate-bob sm:w-[105px]" label="고양이 캐릭터" />
        </div>
      </div>

      {/* 정보 */}
      <div className="flex min-w-0 flex-1 flex-col py-1 pr-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="text-[15px] font-bold">나의 동물</h2>
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">미리보기</span>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-2xl font-extrabold tracking-tight text-brand">
          {pet.name}
          <span className="text-ink-subtle" title={soon}>
            <PencilIcon />
          </span>
        </p>
        <span className="chip mt-1.5 self-start">Lv. {pet.level}</span>

        <div className="mt-4">
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={pet.exp}
            aria-valuemin={0}
            aria-valuemax={pet.expMax}
            aria-label="경험치"
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            <b className="font-semibold text-brand-ink">EXP</b> {pet.exp} / {pet.expMax}
          </p>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-1.5 pt-4 sm:gap-2">
          {actions.map(([icon, label]) => (
            <button
              key={label}
              type="button"
              disabled
              title={soon}
              className="flex cursor-not-allowed flex-col items-center gap-1 rounded-[12px] border border-line bg-field py-2.5 text-[11px] font-medium text-ink-muted sm:text-xs"
            >
              <span className="text-brand-accent">{icon}</span>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-subtle">동물 키우기는 준비 중이에요. 지금 보이는 정보는 예시예요.</p>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
   오늘의 할 일
--------------------------------------------------------------------------- */
function TodayTasks({
  className = '',
  date,
  today,
  tasks,
}: {
  className?: string
  date: string
  today: string
  tasks: Task[]
}) {
  const done = tasks.filter((t) => t.done).length
  const label = date === today ? '오늘의 할 일' : `${fmt(parseDate(date), 'M월 d일')} 할 일`

  return (
    <section className={`card flex flex-col p-5 ${className}`}>
      <h2 className="card-head">
        <ClipboardIcon />
        {label}
        <span className="ml-auto text-sm font-bold text-brand-ink">
          {done} / {tasks.length} 완료
        </span>
      </h2>

      {tasks.length === 0 ? (
        <Empty sprite={<PixelArt sprite={SPROUT} scale={3} />} text="할 일이 없어요. 여유로운 하루를 보내세요!" />
      ) : (
        <ul className="-mx-1.5 max-h-72 space-y-1 overflow-y-auto px-1.5">
          {tasks.map((t) => (
            <li
              key={t.id}
              className={`flex min-h-11 items-center gap-3 rounded-[10px] border px-3 py-2 text-sm ${
                t.done ? 'border-transparent' : 'border-line bg-field'
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${t.done ? 'bg-line-strong' : 'bg-brand-accent'}`}
                aria-hidden="true"
              />
              <span className={`min-w-0 flex-1 truncate ${t.done ? 'text-ink-subtle line-through' : ''}`}>{t.title}</span>
              {t.done ? <span className="sr-only">(완료)</span> : null}
            </li>
          ))}
        </ul>
      )}

      <Link to="/tasks" className="mt-auto self-end pt-3 text-xs font-semibold text-brand-ink hover:underline">
        할 일 전체 보기 →
      </Link>
    </section>
  )
}

/* ---------------------------------------------------------------------------
   월간 캘린더 (작게)
--------------------------------------------------------------------------- */
function MiniCalendar({
  className = '',
  month,
  days,
  selected,
  today,
  busyDays,
  onMonth,
  onSelect,
}: {
  className?: string
  month: Date
  days: Date[]
  selected: string
  today: string
  busyDays: Set<string>
  onMonth: (m: Date) => void
  onSelect: (d: string) => void
}) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="card-head">
        <CalendarIcon />
        {fmt(month, 'yyyy년 M월')}
        <span className="ml-auto flex">
          <button
            className="btn-ghost btn-icon btn-sm min-h-8 rounded-full"
            onClick={() => onMonth(addMonths(month, -1))}
            aria-label="이전 달"
          >
            <ChevronLeft />
          </button>
          <button
            className="btn-ghost btn-icon btn-sm min-h-8 rounded-full"
            onClick={() => onMonth(addMonths(month, 1))}
            aria-label="다음 달"
          >
            <ChevronRight />
          </button>
        </span>
      </h2>

      <div className="grid grid-cols-7 text-center text-xs font-semibold">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`pb-2 ${i === 0 ? 'text-sunday' : 'text-ink-muted'}`}>
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const ds = toDateStr(d)
          if (!isSameMonth(d, month)) return <div key={ds} />
          const isSel = ds === selected
          const isToday = ds === today
          return (
            <button
              key={ds}
              onClick={() => onSelect(ds)}
              aria-label={fmt(d, 'M월 d일 (EEE)')}
              aria-pressed={isSel}
              className={`relative mx-auto my-0.5 grid h-9 w-9 place-items-center rounded-full text-sm transition ${
                isSel
                  ? 'bg-brand font-bold text-white shadow-raised'
                  : isToday
                    ? 'font-bold text-brand-ink ring-2 ring-brand-accent ring-inset hover:bg-brand-soft'
                    : `font-medium hover:bg-surface-hover ${i % 7 === 0 ? 'text-sunday' : 'text-ink'}`
              }`}
            >
              {d.getDate()}
              {busyDays.has(ds) && (
                <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSel ? 'bg-white' : 'bg-brand-accent'}`} aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
   오늘의 일정 (타임라인)
--------------------------------------------------------------------------- */
function TodaySchedule({
  className = '',
  date,
  today,
  events,
  onAdd,
  onOpen,
}: {
  className?: string
  date: string
  today: string
  events: CalendarEvent[]
  onAdd: () => void
  onOpen: (e: CalendarEvent) => void
}) {
  const now = toDateTimeStr(new Date())
  const label = date === today ? '오늘의 일정' : `${fmt(parseDate(date), 'M월 d일')} 일정`

  return (
    <section className={`card flex flex-col p-5 ${className}`}>
      <h2 className="card-head">
        <CalendarIcon />
        {label}
        <button
          className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-brand transition hover:bg-brand-light/60"
          onClick={onAdd}
          aria-label="일정 추가"
        >
          <PlusIcon />
        </button>
      </h2>

      {events.length === 0 ? (
        <Empty sprite={<PixelArt sprite={FLOWER} scale={4} />} text="등록된 일정이 없어요." />
      ) : (
        <ol className="relative max-h-80 space-y-1.5 overflow-y-auto">
          <span className="absolute top-3 bottom-3 left-[4px] w-px bg-line-strong" aria-hidden="true" />
          {events.map((e) => {
            const past = e.end_at < now
            const time = e.all_day ? '종일' : e.start_at.slice(0, 10) < date ? '계속' : e.start_at.slice(11)
            return (
              <li key={e.id} className="relative flex items-center gap-3">
                <span
                  className={`z-10 h-[9px] w-[9px] shrink-0 rounded-full ring-4 ring-surface ${past ? 'bg-line-strong' : 'bg-brand-accent'}`}
                />
                <span className={`w-11 shrink-0 text-sm tabular-nums ${past ? 'text-ink-subtle' : 'font-medium text-ink'}`}>{time}</span>
                <button
                  onClick={() => onOpen(e)}
                  className={`min-h-10 min-w-0 flex-1 truncate rounded-[10px] px-3 text-left text-sm font-medium transition hover:brightness-[0.97] ${past ? 'opacity-70' : ''}`}
                  style={{
                    background: `color-mix(in oklab, ${COLOR_HEX[e.color]} 17%, white)`,
                  }}
                >
                  {e.title || '제목 없음'}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <Link to="/calendar" className="mt-auto self-end pt-3 text-xs font-semibold text-brand-ink hover:underline">
        일정 관리로 이동 →
      </Link>
    </section>
  )
}

/* ---------------------------------------------------------------------------
   이번 주 진행률 · 연속 달성 (실제 할 일 데이터로 계산)
--------------------------------------------------------------------------- */
function WeekProgress({ done, total, pct }: { done: number; total: number; pct: number }) {
  return (
    <section className="card relative flex flex-col overflow-hidden p-4 sm:p-5">
      <h2 className="card-head mb-2">
        <BarsIcon />
        <span className="truncate">이번 주 진행률</span>
      </h2>
      <p className="text-[28px] leading-none font-extrabold tracking-tight text-brand sm:text-[32px]">{pct}%</p>
      <p className="mt-2 text-xs text-ink-muted">{total ? `완료 ${done}개 / 전체 ${total}개` : '이번 주 마감인 할 일이 없어요'}</p>
      <div
        className="progress mt-3 sm:mr-12"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="이번 주 진행률"
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <PixelArt sprite={SPROUT} scale={4} className="absolute right-4 bottom-4 hidden sm:block" />
    </section>
  )
}

function Streak({ count, doneToday }: { count: number; doneToday: boolean }) {
  const message =
    count === 0 ? '오늘 할 일 하나를 완료하고 시작해봐요!' : doneToday ? '꾸준히 이어가고 있어요! 🔥' : '오늘도 완료하면 기록이 이어져요!'
  return (
    <section className="card relative flex flex-col overflow-hidden p-4 sm:p-5">
      <h2 className="card-head mb-2">
        <span aria-hidden="true">🔥</span>
        <span className="truncate">연속 달성</span>
      </h2>
      <span className="chip self-start px-3 py-1 text-base">{count}일째</span>
      <p className="mt-2 text-xs leading-snug text-ink-muted sm:mr-16">{message}</p>
      <PixelArt sprite={MOUND} scale={4} className="absolute right-3 bottom-3 hidden sm:block" />
    </section>
  )
}

function Empty({ sprite, text }: { sprite: ReactNode; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-ink-subtle">
      {sprite}
      {text}
    </div>
  )
}
