import { useState } from 'react'
import { api } from '../lib/api'
import { toDateTimeStr } from '../lib/date'
import { DateField } from './DateTimePicker'
import { Field, Modal } from './Modal'

const PRIORITIES: [number, string][] = [
  [0, '없음'],
  [1, '낮음'],
  [2, '보통'],
  [3, '높음'],
]

/** 할 일 추가 창 (상단 바 '+ 추가'에서 사용) */
export function NewTaskModal({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(date)
  const [priority, setPriority] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await api.post('/tasks', { title, due_date: due || null, priority, created_at: toDateTimeStr(new Date()) })
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
          <button type="submit" form="new-task-form" className="btn-primary" disabled={saving || !title.trim()}>
            추가
          </button>
        </>
      }
    >
      <form id="new-task-form" onSubmit={save} className="space-y-4">
        <Field label="할 일">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} autoFocus required />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-muted">마감일</p>
          <DateField label="마감일" value={due} onChange={setDue} clearable emptyLabel="기한 없음" />
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
