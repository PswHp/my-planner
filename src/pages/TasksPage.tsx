import { addDays } from 'date-fns'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useDataChanged } from '../lib/quickAdd'
import { DeleteDialog, SeriesEditDialog } from '../components/SeriesDialogs'
import { DateField } from '../components/DateTimePicker'
import { EventCalendarPanel } from '../components/EventCalendarPanel'
import { RepeatIcon, TrashIcon } from '../components/Icons'
import { PageHeader } from '../components/Layout'
import { Field, Modal } from '../components/Modal'
import { api, type Task } from '../lib/api'
import { fmt, parseDate, toDateStr, toDateTimeStr, todayStr } from '../lib/date'

type Filter = 'all' | 'active' | 'done'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '진행 중' },
  { key: 'done', label: '완료' },
]

const PRIORITY: Record<number, { label: string; className: string }> = {
  0: { label: '없음', className: '' },
  1: { label: '낮음', className: 'bg-surface-muted text-ink-muted' },
  2: { label: '보통', className: 'bg-warning-soft text-warning' },
  3: { label: '높음', className: 'bg-danger-soft text-danger' },
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .get<Task[]>('/tasks')
      .then((t) => {
        setTasks(t)
        setError(null)
      })
      .catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])
  useDataChanged(load) // 상단 바에서 추가하면 다시 불러오기

  const today = todayStr()

  const toggle = async (t: Task) => {
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

  const groups = useMemo(() => {
    const visible = tasks.filter((t) => {
      if (filter === 'active') return !t.done
      if (filter === 'done') return !!t.done
      return true
    })
    if (filter === 'done') {
      const sorted = [...visible].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
      return [{ title: '완료한 할 일', items: sorted }]
    }
    const tomorrow = toDateStr(addDays(new Date(), 1))
    const buckets = [
      // always: 할 일이 없어도 항상 보이는 묶음
      {
        title: '오늘',
        items: [] as Task[],
        always: true,
        empty: '오늘 마감인 할 일이 없어요',
        test: (t: Task) => t.due_date === today,
      },
      {
        title: '기한 지남',
        items: [] as Task[],
        always: true,
        empty: '밀린 일이 없어요. 잘 하고 있어요!',
        test: (t: Task) => !t.done && !!t.due_date && t.due_date < today,
      },
      { title: '내일', items: [] as Task[], test: (t: Task) => t.due_date === tomorrow },
      { title: '남은 일', items: [] as Task[], test: (t: Task) => !!t.due_date && t.due_date > tomorrow },
      { title: '기한 없음', items: [] as Task[], test: (t: Task) => !t.due_date },
    ]
    // 어느 묶음에도 해당하지 않는 할 일(기한이 지난 완료 항목)은 '완료' 탭에서만 보입니다
    for (const t of visible) buckets.find((b) => b.test(t))?.items.push(t)
    return buckets.filter((b) => b.items.length > 0 || ('always' in b && b.always))
  }, [tasks, filter, today])

  const openCount = tasks.filter((t) => !t.done).length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="할 일" description={openCount > 0 ? `남은 할 일 ${openCount}개` : '모든 할 일을 끝냈어요'} />

      <QuickAdd onAdded={load} />

      <div className="segmented mt-5 mb-5" role="tablist" aria-label="할 일 필터">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="alert-error mb-4">{error}</p>}

      {groups.length === 0 && (
        <div className="card py-14 text-center">
          <p className="text-2xl" aria-hidden="true">
            🌱
          </p>
          <p className="mt-2 text-sm text-ink-muted">할 일이 없습니다</p>
        </div>
      )}

      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.title}>
            <h2
              className={`mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold ${g.title === '기한 지남' ? 'text-danger' : 'text-ink-muted'}`}
            >
              {g.title}
              <span className="rounded-full bg-surface-sunken px-1.5 py-px text-[11px] font-medium text-ink-muted">{g.items.length}</span>
            </h2>
            {g.items.length === 0 && 'empty' in g ? (
              <p className="card px-4 py-3.5 text-sm text-ink-subtle">{g.empty}</p>
            ) : (
              <ul className="card divide-y divide-line overflow-hidden">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-surface-muted">
                    {/* 기한 지난 항목은 완료 체크 없음 (모든 항목 오른쪽에 삭제 버튼) */}
                    {g.title !== '기한 지남' && (
                      <input
                        type="checkbox"
                        checked={!!t.done}
                        onChange={() => toggle(t)}
                        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
                        aria-label={`${t.title} 완료`}
                      />
                    )}
                    <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setEditing(t)}>
                      <span className={`block text-sm ${t.done ? 'text-ink-subtle line-through' : ''}`}>{t.title}</span>
                      {(t.notes || t.due_date || t.priority > 0) && (
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                          {t.priority > 0 && (
                            <span className={`rounded-full px-2 py-px font-medium ${PRIORITY[t.priority].className}`}>
                              {PRIORITY[t.priority].label}
                            </span>
                          )}
                          {t.due_date && (
                            <span className={!t.done && t.due_date < today ? 'text-danger' : ''}>
                              {fmt(parseDate(t.due_date), 'M월 d일 (EEE)')}
                            </span>
                          )}
                          {t.series_id && (
                            <span className="inline-flex items-center gap-0.5 text-brand-ink">
                              <RepeatIcon size={12} />
                              반복
                            </span>
                          )}
                          {t.notes && <span className="truncate">{t.notes}</span>}
                        </span>
                      )}
                    </button>
                    <button
                      className="btn-danger btn-icon -my-1.5 -mr-2 min-h-9 shrink-0 rounded-full"
                      onClick={() => setDeleting(t)}
                      aria-label={`${t.title} 삭제`}
                      title="삭제"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {deleting && (
        <DeleteDialog
          noun="할 일"
          series={!!deleting.series_id}
          message={`${deleting.title}${deleting.due_date ? ` · ${fmt(parseDate(deleting.due_date), 'M월 d일')} 마감` : ''}`}
          onOne={async () => {
            await api.del(`/tasks/${deleting.id}`)
            setDeleting(null)
            load()
          }}
          onAll={async () => {
            await api.del(`/tasks/series/${deleting.series_id}`)
            setDeleting(null)
            load()
          }}
          onCancel={() => setDeleting(null)}
        />
      )}

      {editing && (
        <TaskModal
          task={editing}
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

function QuickAdd({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(todayStr())
  const [priority, setPriority] = useState(0)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      await api.post('/tasks', { title, due_date: due || null, priority, created_at: toDateTimeStr(new Date()) })
      setTitle('')
      onAdded()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="card flex flex-wrap items-center gap-2 p-2 transition focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/15"
    >
      <input
        className="min-h-10 min-w-40 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-ink-subtle"
        placeholder="할 일 추가…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="할 일 제목"
      />
      <DateField label="마감일" value={due} onChange={setDue} clearable emptyLabel="기한 없음" compact />
      <select
        className="min-h-9 rounded-lg border border-line bg-surface-muted px-2 text-xs text-ink-muted transition hover:border-line-strong"
        value={priority}
        onChange={(e) => setPriority(Number(e.target.value))}
        aria-label="우선순위"
      >
        {[0, 1, 2, 3].map((p) => (
          <option key={p} value={p}>
            우선순위: {PRIORITY[p].label}
          </option>
        ))}
      </select>
      <button className="btn-primary" disabled={busy || !title.trim()}>
        추가
      </button>
    </form>
  )
}

function TaskModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [due, setDue] = useState(task.due_date ?? '')
  const [priority, setPriority] = useState<number>(task.priority)
  const [error, setError] = useState<string | null>(null)

  const [askSaveScope, setAskSaveScope] = useState(false)
  const single = () => api.patch(`/tasks/${task.id}`, { title, notes, due_date: due || null, priority })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (task.series_id) return setAskSaveScope(true) // 이 할 일만 / 반복 전체
    try {
      await single()
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const remove = async () => {
    await api.del(`/tasks/${task.id}`)
    onSaved()
  }

  return (
    <>
      {askSaveScope && (
        <SeriesEditDialog
          noun="할 일"
          keeps="마감일과 완료 여부는"
          changes="제목 · 메모 · 우선순위"
          onOne={async () => {
            await single()
            onSaved()
          }}
          onAll={async () => {
            await api.patch(`/tasks/series/${task.series_id}`, { title, notes, priority })
            onSaved()
          }}
          onCancel={() => setAskSaveScope(false)}
        />
      )}
      {confirmingDelete && (
        <DeleteDialog
          noun="할 일"
          series={!!task.series_id}
          message={title.trim() || task.title}
          onOne={remove}
          onAll={async () => {
            await api.del(`/tasks/series/${task.series_id}`)
            onSaved()
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      <Modal
        title="할 일 수정"
        onClose={onClose}
        aside={
          <EventCalendarPanel kind="task" focus={due || todayStr()} rangeStart={due} rangeEnd={due} excludeId={task.id} onPick={setDue} />
        }
        footer={
          <>
            <button type="button" className="btn-danger" onClick={() => setConfirmingDelete(true)}>
              삭제
            </button>
            <button type="button" className="btn-ghost ml-auto" onClick={onClose}>
              취소
            </button>
            <button type="submit" form="task-form" className="btn-primary" disabled={!title.trim()}>
              저장
            </button>
          </>
        }
      >
        <form id="task-form" onSubmit={save} className="space-y-4">
          <Field label="제목">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          {task.series_id && (
            <p className="flex items-center gap-1.5 rounded-control bg-brand-soft px-3 py-2 text-xs font-medium text-brand-ink">
              <RepeatIcon size={16} /> 반복 할 일에 속한 할 일이에요
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="마감일">
              <DateField label="마감일" value={due} onChange={setDue} clearable emptyLabel="기한 없음" />
            </Field>
            <Field label="우선순위">
              <select className="input" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                {[0, 1, 2, 3].map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY[p].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="메모">
            <textarea className="input min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <p className="alert-error">{error}</p>}
        </form>
      </Modal>
    </>
  )
}
