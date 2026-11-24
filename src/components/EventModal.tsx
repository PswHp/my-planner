import { addDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { api, type CalendarEvent, type Color } from '../lib/api'
import { fmt, formatDuration, parseDate, timeToMin, toDateStr, toDateTimeStr } from '../lib/date'
import { ChoiceDialog } from './ChoiceDialog'
import { ColorPicker } from './ColorPicker'
import { ConfirmDialog } from './ConfirmDialog'
import { DateField, TimeField } from './DateTimePicker'
import { RepeatIcon } from './Icons'
import { Field, Modal } from './Modal'

/** 반복 일정 한 번에 만들 수 있는 최대 개수 · 기간 (서버 functions/_lib/series.ts 와 동일) */
const MAX_COUNT = 366
const MAX_SPAN_DAYS = 366

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

/** from~until 에서 선택한 요일에 해당하는 날짜 수 */
function countDates(from: string, until: string, days: Set<number>) {
  if (until < from || days.size === 0) return { count: 0, span: 0 }
  const start = parseDate(from)
  const end = parseDate(until)
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (span > MAX_SPAN_DAYS) return { count: 0, span }
  let count = 0
  for (let d = start; d <= end; d = addDays(d, 1)) if (days.has(d.getDay())) count++
  return { count, span }
}

export function EventModal({ initial, onClose, onSaved }: { initial: Partial<CalendarEvent>; onClose: () => void; onSaved: () => void }) {
  const isNew = !initial.id
  const seriesId = initial.series_id ?? null

  const [title, setTitle] = useState(initial.title ?? '')
  const [allDay, setAllDay] = useState(!!initial.all_day)
  const [startDate, setStartDate] = useState(initial.start_at!.slice(0, 10))
  const [startTime, setStartTime] = useState(initial.all_day ? '09:00' : initial.start_at!.slice(11))
  const [endDate, setEndDate] = useState(initial.end_at!.slice(0, 10))
  const [endTime, setEndTime] = useState(initial.all_day ? '10:00' : initial.end_at!.slice(11))
  const [color, setColor] = useState<Color>(initial.color ?? 'blue')
  const [description, setDescription] = useState(initial.description ?? '')

  // 반복 (새 일정에서만)
  const [repeat, setRepeat] = useState(false)
  const [until, setUntil] = useState(() => toDateStr(addDays(parseDate(initial.start_at!.slice(0, 10)), 27)))
  const [days, setDays] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4, 5, 6]))

  // 일정 길이(분) — 시작을 옮기면 길이를 유지한 채 종료도 함께 이동
  const at = (d: string, t: string) => parseDate(d).getTime() + timeToMin(t) * 60_000
  const duration = Math.round((at(endDate, endTime) - at(startDate, startTime)) / 60_000)
  const setEndFrom = (ms: number) => {
    const s = toDateTimeStr(new Date(ms))
    setEndDate(s.slice(0, 10))
    setEndTime(s.slice(11))
  }
  const moveStart = (d: string, t: string) => {
    if (repeat && until < d) setUntil(d)
    if (allDay) {
      const span = repeat ? 0 : Math.round((parseDate(endDate).getTime() - parseDate(startDate).getTime()) / 86_400_000)
      setStartDate(d)
      setEndDate(toDateStr(addDays(parseDate(d), Math.max(0, span))))
      return
    }
    const keep = duration > 0 ? duration : 60
    setStartDate(d)
    setStartTime(t)
    setEndFrom(at(d, t) + keep * 60_000)
  }
  const setLength = (min: number) => setEndFrom(at(startDate, startTime) + min * 60_000)

  const toggleRepeat = (on: boolean) => {
    setRepeat(on)
    if (on) {
      // 반복 일정은 하루 안에서 끝나는 일정만 — 종료 날짜를 시작 날짜와 맞춤
      setEndDate(startDate)
      if (until < startDate) setUntil(toDateStr(addDays(parseDate(startDate), 27)))
    }
  }
  const toggleDay = (d: number) =>
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  const presetActive = (list: number[]) => list.length === days.size && list.every((d) => days.has(d))

  const { count, span } = useMemo(() => countDates(startDate, until, days), [startDate, until, days])
  const repeatProblem = !repeat
    ? null
    : days.size === 0
      ? '요일을 하나 이상 골라 주세요.'
      : span > MAX_SPAN_DAYS
        ? `반복 기간은 최대 ${MAX_SPAN_DAYS}일까지 설정할 수 있어요.`
        : count === 0
          ? '선택한 기간과 요일에 해당하는 날짜가 없어요.'
          : count > MAX_COUNT
            ? `한 번에 최대 ${MAX_COUNT}개까지 만들 수 있어요.`
            : !allDay && endDate !== startDate
              ? '반복 일정은 하루 안에서 끝나야 해요. 종료 시간을 확인해 주세요.'
              : null

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askSaveScope, setAskSaveScope] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const singleBody = () => ({
    title,
    start_at: `${startDate}T${allDay ? '00:00' : startTime}`,
    end_at: `${endDate}T${allDay ? '23:59' : endTime}`,
    all_day: allDay,
    color,
    description,
  })
  const seriesBody = () => ({
    title,
    description,
    color,
    all_day: allDay,
    start_time: allDay ? undefined : startTime,
    end_time: allDay ? undefined : endTime,
  })

  const run = async (fn: () => Promise<unknown>) => {
    setSaving(true)
    setError(null)
    try {
      await fn()
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (repeat) {
      if (repeatProblem) return setError(repeatProblem)
      return run(() => api.post('/events/series', { ...seriesBody(), from: startDate, until, days: [...days] }))
    }
    const body = singleBody()
    if (body.end_at < body.start_at) return setError('종료 시각이 시작 시각보다 빠릅니다.')
    if (seriesId) return setAskSaveScope(true) // 이 일정만 / 전체 선택
    return run(() => (isNew ? api.post('/events', body) : api.patch(`/events/${initial.id}`, body)))
  }

  const whenLabel = `${fmt(parseDate(startDate), 'M월 d일 (EEE)')} ${allDay ? '종일' : startTime}`

  return (
    <>
      {/* 반복 일정 수정 범위 선택 */}
      {askSaveScope && (
        <ChoiceDialog
          title="반복 일정을 수정할까요?"
          icon={<RepeatIcon size={22} />}
          message={
            <>
              <b className="font-semibold text-ink">반복 일정 전체</b>를 고르면 각 일정의 날짜는 그대로 두고
              <br />
              제목 · 시간 · 색 · 메모만 모두 바꿔요.
            </>
          }
          choices={[
            {
              label: '이 일정만 수정',
              variant: 'secondary',
              onSelect: async () => {
                await api.patch(`/events/${initial.id}`, singleBody())
                onSaved()
              },
            },
            {
              label: '반복 일정 전체 수정',
              variant: 'primary',
              onSelect: async () => {
                await api.patch(`/events/series/${seriesId}`, seriesBody())
                onSaved()
              },
            },
          ]}
          onCancel={() => setAskSaveScope(false)}
        />
      )}

      {/* 삭제 확인 — 반복 일정이면 범위 선택 */}
      {confirmingDelete &&
        (seriesId ? (
          <ChoiceDialog
            tone="danger"
            title="반복 일정을 삭제할까요?"
            icon={<TrashGlyph />}
            message={`${title.trim() || '제목 없음'} · ${whenLabel}`}
            choices={[
              {
                label: '이 일정만 삭제',
                variant: 'secondary',
                onSelect: async () => {
                  await api.del(`/events/${initial.id}`)
                  onSaved()
                },
              },
              {
                label: '반복 일정 전체 삭제',
                variant: 'danger',
                onSelect: async () => {
                  await api.del(`/events/series/${seriesId}`)
                  onSaved()
                },
              },
            ]}
            onCancel={() => setConfirmingDelete(false)}
          />
        ) : (
          <ConfirmDialog
            title="이 일정을 삭제할까요?"
            message={`${title.trim() || '제목 없음'} · ${whenLabel}`}
            onConfirm={async () => {
              await api.del(`/events/${initial.id}`)
              onSaved()
            }}
            onCancel={() => setConfirmingDelete(false)}
          />
        ))}

      <Modal
        title={isNew ? '새 일정' : '일정 수정'}
        onClose={onClose}
        footer={
          <>
            {!isNew && (
              <button type="button" className="btn-danger" onClick={() => setConfirmingDelete(true)}>
                삭제
              </button>
            )}
            <button type="button" className="btn-ghost ml-auto" onClick={onClose}>
              취소
            </button>
            <button
              type="submit"
              form="event-form"
              className="btn-primary"
              disabled={saving || !title.trim() || (repeat && !!repeatProblem)}
            >
              {repeat ? (count > 0 && !repeatProblem ? `${count}개 추가` : '추가') : '저장'}
            </button>
          </>
        }
      >
        <form id="event-form" onSubmit={save} className="space-y-4">
          <Field label="제목">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </Field>

          {seriesId && (
            <p className="flex items-center gap-1.5 rounded-control bg-brand-soft px-3 py-2 text-xs font-medium text-brand-ink">
              <RepeatIcon size={16} /> 반복 일정에 속한 일정이에요
            </p>
          )}

          <div className="space-y-3 rounded-card bg-surface-muted p-3.5">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-[18px] w-[18px] cursor-pointer"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                />
                종일
              </label>
              {isNew && (
                <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-[18px] w-[18px] cursor-pointer"
                    checked={repeat}
                    onChange={(e) => toggleRepeat(e.target.checked)}
                  />
                  반복 (기간 일괄 추가)
                </label>
              )}
            </div>

            {repeat ? (
              <>
                {/* 반복 기간 */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink-muted">반복 기간</p>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <DateField label="반복 시작일" value={startDate} onChange={(v) => moveStart(v, startTime)} />
                    </div>
                    <span className="text-sm text-ink-subtle" aria-hidden="true">
                      ~
                    </span>
                    <div className="min-w-0 flex-1">
                      <DateField label="반복 종료일" value={until} min={startDate} onChange={setUntil} />
                    </div>
                  </div>
                </div>

                {/* 요일 */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink-muted">요일</p>
                  <div className="segmented mb-2" role="tablist" aria-label="요일 빠른 선택">
                    {PRESETS.map(([label, list]) => (
                      <button
                        key={label}
                        type="button"
                        role="tab"
                        aria-selected={presetActive(list)}
                        onClick={() => setDays(new Set(list))}
                      >
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
                          onClick={() => toggleDay(d)}
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

                {/* 시간 */}
                {!allDay && (
                  <div>
                    <p className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-muted">
                      시간
                      {duration > 0 && <span className="font-medium text-ink-subtle">{formatDuration(duration)}</span>}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <TimeField label="시작 시간" value={startTime} onChange={(v) => moveStart(startDate, v)} />
                      </div>
                      <span className="text-sm text-ink-subtle" aria-hidden="true">
                        ~
                      </span>
                      <div className="min-w-0 flex-1">
                        <TimeField label="종료 시간" value={endTime} onChange={setEndTime} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink-muted">시작</p>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <DateField label="시작 날짜" value={startDate} onChange={(v) => moveStart(v, startTime)} />
                    </div>
                    {!allDay && (
                      <div className="w-[8.5rem] shrink-0">
                        <TimeField label="시작 시간" value={startTime} onChange={(v) => moveStart(startDate, v)} />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-muted">
                    종료
                    {!allDay && duration > 0 && <span className="font-medium text-ink-subtle">{formatDuration(duration)}</span>}
                  </p>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <DateField label="종료 날짜" value={endDate} min={startDate} onChange={setEndDate} />
                    </div>
                    {!allDay && (
                      <div className="w-[8.5rem] shrink-0">
                        <TimeField label="종료 시간" value={endTime} onChange={setEndTime} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {!allDay && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="일정 길이 빠르게 정하기">
                {[30, 60, 90, 120, 180].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLength(m)}
                    aria-pressed={duration === m}
                    className={`min-h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition active:scale-95 ${
                      duration === m
                        ? 'bg-brand text-on-brand'
                        : 'bg-field text-ink-muted ring-1 ring-line hover:bg-brand-soft hover:text-brand-ink'
                    }`}
                  >
                    {formatDuration(m)}
                  </button>
                ))}
              </div>
            )}

            {repeat && (
              <p
                className={`rounded-control px-3 py-2 text-sm font-medium ${
                  repeatProblem ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand-ink'
                }`}
                aria-live="polite"
              >
                {repeatProblem ?? (
                  <>
                    {fmt(parseDate(startDate), 'M월 d일')} ~ {fmt(parseDate(until), 'M월 d일')} 동안 <b>{count}개</b>의 일정이 만들어져요
                  </>
                )}
              </p>
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

const TrashGlyph = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
)
