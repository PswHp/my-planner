import { addDays } from 'date-fns'
import { useMemo, useState, type FormEvent } from 'react'
import { api, CATEGORIES, CATEGORY_INFO, COLOR_HEX, type Category, type Task, type TimeBlock } from '../lib/api'
import { fmt, minToTime, parseDate, timeToMin, toDateStr } from '../lib/date'
import { DateField, TimeField } from './DateTimePicker'
import { RepeatIcon } from './Icons'
import { Field, Modal } from './Modal'
import { ALL_DAYS, RepeatDaysPicker, RepeatSummary, repeatDates, repeatProblem } from './RepeatFields'
import { DeleteDialog, SeriesEditDialog } from './SeriesDialogs'

/** 블록 추가 · 수정 창에 넘기는 값 (새 블록이면 id 없음) */
export type Draft = Partial<TimeBlock> & { date: string; start_min: number; end_min: number }

export function BlockModal({ draft, tasks, onClose, onSaved }: { draft: Draft; tasks: Task[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !draft.id
  const seriesId = draft.series_id ?? null
  const [title, setTitle] = useState(draft.title ?? '')
  const [category, setCategory] = useState<Category>(draft.category ?? 'work')
  const [start, setStart] = useState(minToTime(draft.start_min))
  const [end, setEnd] = useState(minToTime(draft.end_min % 1440)) // 1440(자정)은 00:00으로 표시
  // 시작을 옮기면 블록 길이를 유지한 채 종료도 함께 이동 (자정을 넘기지 않음)
  const moveStart = (v: string) => {
    const len = (timeToMin(end) || 1440) - timeToMin(start)
    setStart(v)
    setEnd(minToTime(Math.min(timeToMin(v) + (len > 0 ? len : 60), 1440) % 1440))
  }
  const [taskId, setTaskId] = useState(draft.task_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 반복 (새 블록에서만)
  const [repeat, setRepeat] = useState(false)
  const [from, setFrom] = useState(draft.date)
  const [until, setUntil] = useState(() => toDateStr(addDays(parseDate(draft.date), 27)))
  const [days, setDays] = useState<Set<number>>(ALL_DAYS)
  const { dates, span } = useMemo(() => repeatDates(from, until, days), [from, until, days])
  const problem = repeat ? repeatProblem(days, span, dates.length) : null

  const [askSaveScope, setAskSaveScope] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fields = () => {
    const start_min = timeToMin(start)
    const endRaw = timeToMin(end)
    const end_min = endRaw === 0 ? 1440 : endRaw // 00:00 종료 = 자정
    return { title, category, start_min, end_min, task_id: taskId || null }
  }

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

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const body = fields()
    if (body.end_min <= body.start_min) return setError('종료 시각은 시작 시각보다 뒤여야 합니다.')
    if (repeat) {
      if (problem) return setError(problem)
      return run(() => api.post('/blocks/series', { ...body, from, until, days: [...days] }))
    }
    if (seriesId) return setAskSaveScope(true)
    return run(() =>
      isNew ? api.post('/blocks', { ...body, date: draft.date }) : api.patch(`/blocks/${draft.id}`, { ...body, date: draft.date }),
    )
  }

  const label = `${title.trim() || '제목 없음'} · ${fmt(parseDate(draft.date), 'M월 d일 (EEE)')} ${start}–${end}${draft.event_id ? ' · 연결된 일정도 함께 삭제돼요' : ''}`

  return (
    <>
      {askSaveScope && (
        <SeriesEditDialog
          noun="블록"
          keeps="날짜는"
          changes="제목 · 시간 · 카테고리 · 연결된 할 일"
          onOne={async () => {
            await api.patch(`/blocks/${draft.id}`, { ...fields(), date: draft.date })
            onSaved()
          }}
          onAll={async () => {
            await api.patch(`/blocks/series/${seriesId}`, fields())
            onSaved()
          }}
          onCancel={() => setAskSaveScope(false)}
        />
      )}
      {confirmingDelete && (
        <DeleteDialog
          noun="블록"
          series={!!seriesId}
          message={label}
          onOne={async () => {
            await api.del(`/blocks/${draft.id}`)
            onSaved()
          }}
          onAll={async () => {
            await api.del(`/blocks/series/${seriesId}`)
            onSaved()
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      <Modal
        title={isNew ? '새 타임 블록' : '블록 수정'}
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
            <button type="submit" form="block-form" className="btn-primary" disabled={saving || !title.trim() || (repeat && !!problem)}>
              {repeat ? (dates.length > 0 && !problem ? `${dates.length}개 추가` : '추가') : '저장'}
            </button>
          </>
        }
      >
        <form id="block-form" onSubmit={save} className="space-y-4">
          <Field label="제목">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>

          {seriesId && (
            <p className="flex items-center gap-1.5 rounded-control bg-brand-soft px-3 py-2 text-xs font-medium text-brand-ink">
              <RepeatIcon size={16} /> 반복 블록에 속한 블록이에요
            </p>
          )}

          <div className="space-y-3 rounded-card bg-surface-muted p-3.5">
            {isNew && (
              <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-[18px] w-[18px] cursor-pointer"
                  checked={repeat}
                  onChange={(e) => setRepeat(e.target.checked)}
                />
                반복 (기간 일괄 추가)
              </label>
            )}

            {repeat && (
              <>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink-muted">반복 기간</p>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <DateField
                        label="반복 시작일"
                        value={from}
                        onChange={(v) => {
                          setFrom(v)
                          if (until < v) setUntil(v)
                        }}
                      />
                    </div>
                    <span className="text-sm text-ink-subtle" aria-hidden="true">
                      ~
                    </span>
                    <div className="min-w-0 flex-1">
                      <DateField label="반복 종료일" value={until} min={from} onChange={setUntil} />
                    </div>
                  </div>
                </div>
                <RepeatDaysPicker days={days} onChange={setDays} />
              </>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink-muted">
                {repeat ? '시간' : `시간 · ${fmt(parseDate(draft.date), 'M월 d일 (EEE)')}`}
              </p>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TimeField label="시작 시간" value={start} onChange={moveStart} minuteStep={15} />
                </div>
                <span className="text-sm text-ink-subtle" aria-hidden="true">
                  ~
                </span>
                <div className="min-w-0 flex-1">
                  <TimeField label="종료 시간" value={end} onChange={setEnd} minuteStep={15} />
                </div>
              </div>
            </div>

            {repeat && <RepeatSummary from={from} until={until} count={dates.length} problem={problem} noun="블록" />}
          </div>

          <p className="rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-muted">
            {draft.event_id || isNew
              ? '일정 관리에도 같은 시간의 일정으로 함께 표시돼요. 한쪽을 고치거나 지우면 같이 바뀌어요.'
              : '저장하면 일정 관리에도 같은 시간의 일정이 함께 만들어져요.'}
          </p>

          <Field label="카테고리">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition duration-150 ${
                    category === c ? 'border-inverse bg-inverse text-on-inverse' : 'border-line hover:bg-surface-hover'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[CATEGORY_INFO[c].color] }} />
                  {CATEGORY_INFO[c].label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="연결된 할 일 (선택)">
            <select className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">없음</option>
              {draft.task_id && !tasks.some((t) => t.id === draft.task_id) && <option value={draft.task_id}>(완료된 할 일)</option>}
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          {error && <p className="alert-error">{error}</p>}
        </form>
      </Modal>
    </>
  )
}
