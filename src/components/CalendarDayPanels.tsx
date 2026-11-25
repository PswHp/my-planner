import { useState } from 'react'
import { Link } from 'react-router'
import { api, CATEGORY_INFO, COLOR_HEX, type Task, type TimeBlock } from '../lib/api'
import { fmt, minToTime, parseDate, toDateTimeStr } from '../lib/date'

/* 캘린더 화면 오른쪽: 선택한 날의 타임 블록 · 할 일 */

/** 선택한 날의 타임 블록 (보기 전용 — 누르면 타임 블록 화면의 그 날짜로 이동) */
export function DayBlocks({ date, blocks }: { date: string; blocks: TimeBlock[] }) {
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min)
  return (
    <div className="card p-4">
      <h2 className="section-title mb-3">
        타임 블록 <span className="text-sm font-normal text-ink-muted">{sorted.length ? `${sorted.length}개` : ''}</span>
      </h2>
      {sorted.length === 0 ? (
        <p className="rounded-control bg-surface-muted py-4 text-center text-sm text-ink-subtle">이 날 계획한 블록이 없습니다</p>
      ) : (
        <ul className="space-y-0.5">
          {sorted.map((b) => (
            <li key={b.id} className="flex min-h-9 items-center gap-2.5 rounded-control px-2 py-1.5 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: COLOR_HEX[CATEGORY_INFO[b.category].color] }}
                aria-hidden="true"
              />
              <span className="w-[5.5rem] shrink-0 text-xs whitespace-nowrap text-ink-muted tabular-nums">
                {minToTime(b.start_min)}–{minToTime(b.end_min)}
              </span>
              <span className="min-w-0 flex-1 truncate">{b.title}</span>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/blocks?date=${date}`} className="mt-3 block text-right text-xs font-semibold text-brand-ink hover:underline">
        타임 블록에서 보기 →
      </Link>
    </div>
  )
}

export function DayTasks({
  date,
  tasks,
  undated,
  onAdded,
}: {
  date: string
  tasks: Task[]
  /** 기한 없는 미완료 할 일 (오늘일 때만) */
  undated: Task[]
  onAdded: () => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
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
      <h2 className="section-title mb-3">
        할 일 <span className="text-sm font-normal text-ink-muted">{tasks.length ? `${openCount}/${tasks.length}` : ''}</span>
      </h2>

      {tasks.length === 0 && undated.length === 0 && (
        <p className="rounded-control bg-surface-muted py-5 text-center text-sm text-ink-subtle">이 날 마감인 할 일이 없습니다</p>
      )}
      <ul className="space-y-0.5">
        {tasks.map((t) => {
          return (
            <li key={t.id}>
              <div className="flex min-h-10 items-start gap-2.5 rounded-control px-2 py-2">
                <span
                  className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${t.done ? 'bg-line-strong' : 'bg-brand-accent'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${t.done ? 'text-ink-subtle line-through' : ''}`}>{t.title}</span>
                </span>
                {t.priority === 3 && !t.done && (
                  <span className="rounded bg-danger-soft px-1.5 py-px text-[11px] font-medium text-danger">높음</span>
                )}
                {t.done ? <span className="sr-only">(완료)</span> : null}
              </div>
            </li>
          )
        })}
      </ul>
      {undated.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 px-2 text-xs font-semibold text-ink-subtle">기한 없음</p>
          <ul className="space-y-0.5">
            {undated.map((t) => (
              <li key={t.id} className="flex min-h-10 items-start gap-2.5 rounded-control px-2 py-2">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-point-purple" aria-hidden="true" />
                <span className="block min-w-0 flex-1 truncate text-sm">{t.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <Link to="/tasks" className="mt-3 block text-right text-xs font-semibold text-brand-ink hover:underline">
        할 일 전체 보기 →
      </Link>
    </div>
  )
}
