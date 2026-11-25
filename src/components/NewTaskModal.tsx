import { addDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { api } from '../lib/api'
import { parseDate, toDateStr, toDateTimeStr } from '../lib/date'
import { DateField } from './DateTimePicker'
import { Field, Modal } from './Modal'
import { ALL_DAYS, RepeatDaysPicker, RepeatSummary, repeatDates, repeatProblem } from './RepeatFields'

const PRIORITIES: [number, string][] = [
  [0, '없음'],
  [1, '낮음'],
  [2, '보통'],
  [3, '높음'],
]

/** 할 일 추가 창 (상단 바 '+ 추가'에서 사용) — 반복(기간 일괄 추가) 가능 */
export function NewTaskModal({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(date)
  const [priority, setPriority] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 반복: 기간 · 요일의 날짜마다 그날이 마감인 할 일을 만듦
  const [repeat, setRepeat] = useState(false)
  const [from, setFrom] = useState(date)
  const [until, setUntil] = useState(() => toDateStr(addDays(parseDate(date), 27)))
  const [days, setDays] = useState<Set<number>>(ALL_DAYS)
  const { dates, span } = useMemo(() => repeatDates(from, until, days), [from, until, days])
  const problem = repeat ? repeatProblem(days, span, dates.length) : null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    if (problem) return setError(problem)
    setSaving(true)
    setError(null)
    try {
      const created_at = toDateTimeStr(new Date())
      if (repeat) await api.post('/tasks/series', { title, priority, from, until, days: [...days], created_at })
      else await api.post('/tasks', { title, due_date: due || null, priority, created_at })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="새 할 일"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost ml-auto" onClick={onClose}>
            취소
          </button>
          <button type="submit" form="new-task-form" className="btn-primary" disabled={saving || !title.trim() || !!problem}>
            {repeat ? (dates.length > 0 && !problem ? `${dates.length}개 추가` : '추가') : '추가'}
          </button>
        </>
      }
    >
      <form id="new-task-form" onSubmit={save} className="space-y-4">
        <Field label="할 일">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} autoFocus required />
        </Field>

        <div className="space-y-3 rounded-card bg-surface-muted p-3.5">
          <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-[18px] w-[18px] cursor-pointer"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
            />
            반복 (기간 일괄 추가)
          </label>

          {repeat ? (
            <>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ink-muted">반복 기간 (날짜마다 그날이 마감인 할 일)</p>
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
              <RepeatSummary from={from} until={until} count={dates.length} problem={problem} noun="할 일" />
            </>
          ) : (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink-muted">마감일</p>
              <DateField label="마감일" value={due} onChange={setDue} clearable emptyLabel="기한 없음" />
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-muted">우선순위</p>
          <div className="segmented" role="tablist" aria-label="우선순위">
            {PRIORITIES.map(([p, label]) => (
              <button key={p} type="button" role="tab" aria-selected={priority === p} onClick={() => setPriority(p)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="alert-error">{error}</p>}
      </form>
    </Modal>
  )
}
