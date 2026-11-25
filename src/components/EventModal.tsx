import { addDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { api, CATEGORIES, CATEGORY_INFO, COLOR_HEX, type CalendarEvent, type Category, type Color } from '../lib/api'
import { fmt, formatDuration, parseDate, timeToMin, toDateStr, toDateTimeStr } from '../lib/date'
import { ColorPicker } from './ColorPicker'
import { DateField, TimeField } from './DateTimePicker'
import { EventCalendarPanel } from './EventCalendarPanel'
import { RepeatIcon } from './Icons'
import { ALL_DAYS, MAX_REPEAT_SPAN_DAYS, RepeatDaysPicker, RepeatSummary, repeatDates, repeatProblem as rangeProblem } from './RepeatFields'
import { Field, Modal } from './Modal'
import { DeleteDialog, SeriesEditDialog } from './SeriesDialogs'

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
  // 함께 만들어지는 타임 블록의 카테고리 (기존 연결이 있으면 그 카테고리, 없으면 색으로 추정)
  const [category, setCategory] = useState<Category>(
    () => initial.block_category ?? CATEGORIES.find((c) => CATEGORY_INFO[c].color === (initial.color ?? 'blue')) ?? 'personal',
  )
  const [description, setDescription] = useState(initial.description ?? '')

  // 반복 (새 일정에서만)
  const [repeat, setRepeat] = useState(false)
  const [until, setUntil] = useState(() => toDateStr(addDays(parseDate(initial.start_at!.slice(0, 10)), 27)))
  const [days, setDays] = useState<Set<number>>(ALL_DAYS)

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
  const { dates: repeatList, span } = useMemo(() => repeatDates(startDate, until, days), [startDate, until, days])
  const count = repeatList.length

  // 왼쪽 달력 — 반복이면 실제로 만들어질 날짜들을 표시
  const [pickTarget, setPickTarget] = useState<'start' | 'until'>('start')
  const marked = useMemo(() => (repeat && span <= MAX_REPEAT_SPAN_DAYS ? new Set(repeatList) : undefined), [repeat, span, repeatList])
  const pickFromCalendar = (d: string) => {
    if (repeat && pickTarget === 'until') {
      if (d < startDate) moveStart(d, startTime)
      else setUntil(d)
      return
    }
    moveStart(d, startTime)
  }
  const repeatProblem = !repeat
    ? null
    : (rangeProblem(days, span, count) ??
      (!allDay && endDate !== startDate ? '반복 일정은 하루 안에서 끝나야 해요. 종료 시간을 확인해 주세요.' : null))

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
    category,
  })
  const seriesBody = () => ({
    title,
    description,
    color,
    category,
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
        <SeriesEditDialog
          noun="일정"
          keeps="날짜는"
          changes="제목 · 시간 · 색 · 메모"
          onOne={async () => {
            await api.patch(`/events/${initial.id}`, singleBody())
            onSaved()
          }}
          onAll={async () => {
            await api.patch(`/events/series/${seriesId}`, seriesBody())
            onSaved()
          }}
          onCancel={() => setAskSaveScope(false)}
        />
      )}

      {/* 삭제 확인 — 반복 일정이면 범위 선택 */}
      {confirmingDelete && (
        <DeleteDialog
          noun="일정"
          series={!!seriesId}
          icon={<TrashGlyph />}
          message={`${title.trim() || '제목 없음'} · ${whenLabel}${initial.block_category ? ' · 연결된 타임 블록도 함께 삭제돼요' : ''}`}
          onOne={async () => {
            await api.del(`/events/${initial.id}`)
            onSaved()
          }}
          onAll={async () => {
            await api.del(`/events/series/${seriesId}`)
            onSaved()
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      <Modal
        title={isNew ? '새 일정' : '일정 수정'}
        onClose={onClose}
        aside={
          <EventCalendarPanel
            focus={repeat && pickTarget === 'until' ? until : startDate}
            rangeStart={startDate}
            rangeEnd={repeat ? until : allDay || endDate > startDate ? endDate : startDate}
            marked={marked}
            excludeId={initial.id}
            onPick={pickFromCalendar}
          >
            {repeat && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-ink-muted">달력에서 고를 날짜</p>
                <div className="segmented" role="tablist" aria-label="달력에서 고를 날짜">
                  <button type="button" role="tab" aria-selected={pickTarget === 'start'} onClick={() => setPickTarget('start')}>
                    시작일
                  </button>
                  <button type="button" role="tab" aria-selected={pickTarget === 'until'} onClick={() => setPickTarget('until')}>
                    종료일
                  </button>
                </div>
              </div>
            )}
          </EventCalendarPanel>
        }
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
                <RepeatDaysPicker days={days} onChange={setDays} />

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

            {repeat && <RepeatSummary from={startDate} until={until} count={count} problem={repeatProblem} noun="일정" />}
          </div>

          {/* 타임 블록 연동 — 하루 안의 시간 일정만 */}
          {allDay || (!repeat && endDate !== startDate) ? (
            <p className="rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-muted">
              종일 · 여러 날 일정은 타임 블록에 추가되지 않아요.
            </p>
          ) : (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink-muted">타임 블록에도 함께 추가돼요 · 카테고리</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="타임 블록 카테고리">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => {
                      setCategory(c)
                      setColor(CATEGORY_INFO[c].color) // 카테고리를 고르면 일정 색도 맞춤 (아래에서 바꿀 수 있음)
                    }}
                    className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
                      category === c ? 'border-inverse bg-inverse text-on-inverse' : 'border-line bg-field hover:bg-surface-hover'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: COLOR_HEX[CATEGORY_INFO[c].color] }} aria-hidden="true" />
                    {CATEGORY_INFO[c].label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
