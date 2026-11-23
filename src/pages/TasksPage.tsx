import { addDays } from 'date-fns'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/Layout'
import { Field, Modal } from '../components/Modal'
import { api, type Task } from '../lib/api'
import { fmt, parseDate, toDateStr, toDateTimeStr, todayStr } from '../lib/date'

type Filter = 'active' | 'today' | 'done' | 'all'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'active', label: '진행 중' },
  { key: 'today', label: '오늘' },
  { key: 'done', label: '완료' },
  { key: 'all', label: '전체' },
]

const PRIORITY: Record<number, { label: string; className: string }> = {
  0: { label: '없음', className: '' },
  1: { label: '낮음', className: 'bg-stone-100 text-stone-600' },
  2: { label: '보통', className: 'bg-amber-50 text-[#8a5a00]' },
  3: { label: '높음', className: 'bg-red-50 text-[#b42f2f]' },
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<Filter>('active')
  const [editing, setEditing] = useState<Task | null>(null)
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
      if (filter === 'today') return t.due_date === today || (!t.done && !!t.due_date && t.due_date < today)
      return true
    })
    if (filter === 'done') {
      const sorted = [...visible].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
      return [{ title: '완료한 할 일', items: sorted }]
    }
    const tomorrow = toDateStr(addDays(new Date(), 1))
    const buckets = [
      { title: '기한 지남', items: [] as Task[], test: (t: Task) => !t.done && !!t.due_date && t.due_date < today },
      { title: '오늘', items: [] as Task[], test: (t: Task) => t.due_date === today },
      { title: '내일', items: [] as Task[], test: (t: Task) => t.due_date === tomorrow },
      { title: '예정', items: [] as Task[], test: (t: Task) => !!t.due_date && t.due_date > tomorrow },
      { title: '기한 없음', items: [] as Task[], test: (t: Task) => !t.due_date },
      { title: '지난 할 일', items: [] as Task[], test: () => true },
    ]
    for (const t of visible) buckets.find((b) => b.test(t))!.items.push(t)
    return buckets.filter((b) => b.items.length > 0)
  }, [tasks, filter, today])

  const openCount = tasks.filter((t) => !t.done).length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="할 일">
        <span className="text-sm text-stone-500">남은 할 일 {openCount}개</span>
      </PageHeader>

      <QuickAdd onAdded={load} />

      <div className="mt-5 mb-4 flex gap-1 rounded-lg bg-stone-200/60 p-1 text-sm" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 cursor-pointer rounded-md py-1.5 font-medium transition ${
              filter === f.key ? 'bg-white shadow-sm' : 'text-stone-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#b42f2f]">{error}</p>}

      {groups.length === 0 && <p className="py-16 text-center text-sm text-stone-400">할 일이 없습니다</p>}

      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className={`mb-2 text-xs font-semibold ${g.title === '기한 지남' ? 'text-[#b42f2f]' : 'text-stone-500'}`}>
              {g.title} <span className="font-normal">{g.items.length}</span>
            </h2>
            <ul className="card divide-y divide-stone-100">
              {g.items.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={!!t.done}
                    onChange={() => toggle(t)}
                    className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer accent-c-blue"
                    aria-label={`${t.title} 완료`}
                  />
                  <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setEditing(t)}>
                    <span className={`block text-sm ${t.done ? 'text-stone-400 line-through' : ''}`}>{t.title}</span>
                    {(t.notes || t.due_date || t.priority > 0) && (
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        {t.priority > 0 && (
                          <span className={`rounded px-1.5 py-px font-medium ${PRIORITY[t.priority].className}`}>
                            {PRIORITY[t.priority].label}
                          </span>
                        )}
                        {t.due_date && (
                          <span className={!t.done && t.due_date < today ? 'text-[#b42f2f]' : ''}>
                            {fmt(parseDate(t.due_date), 'M월 d일 (EEE)')}
                          </span>
                        )}
                        {t.notes && <span className="truncate">{t.notes}</span>}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

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
    <form onSubmit={submit} className="card flex flex-wrap items-center gap-2 p-2">
      <input
        className="min-w-40 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none"
        placeholder="할 일 추가…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="할 일 제목"
      />
      <input
        type="date"
        className="rounded-md border border-stone-200 px-2 py-1 text-xs"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        aria-label="마감일"
      />
      <select
        className="rounded-md border border-stone-200 px-2 py-1 text-xs"
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
      <button className="btn-primary py-1.5" disabled={busy || !title.trim()}>
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

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.patch(`/tasks/${task.id}`, { title, notes, due_date: due || null, priority })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async () => {
    if (!confirm('이 할 일을 삭제할까요?')) return
    await api.del(`/tasks/${task.id}`)
    onSaved()
  }

  return (
    <Modal
      title="할 일 수정"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-danger" onClick={remove}>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="마감일">
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
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
        {error && <p className="text-sm text-[#b42f2f]">{error}</p>}
      </form>
    </Modal>
  )
}
