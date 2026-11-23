import { addDays } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ChevronLeft, ChevronRight, PlusIcon } from '../components/Icons'
import { PageHeader } from '../components/Layout'
import { Field, Modal } from '../components/Modal'
import { api, CATEGORIES, CATEGORY_INFO, COLOR_HEX, type Category, type Task, type TimeBlock } from '../lib/api'
import { fmt, formatDuration, minToTime, parseDate, timeToMin, toDateStr, todayStr } from '../lib/date'

const HOUR_PX = 56
const SNAP = 15
const PX_PER_MIN = HOUR_PX / 60

type Draft = Partial<TimeBlock> & { date: string; start_min: number; end_min: number }

/** 겹치는 블록을 나란히 배치하기 위한 lane 계산 */
function layoutBlocks(blocks: TimeBlock[]) {
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min || b.end_min - a.end_min)
  const out: { block: TimeBlock; lane: number; lanes: number }[] = []
  let cluster: typeof out = []
  let clusterEnd = -1
  let laneEnds: number[] = []
  const flush = () => {
    const n = laneEnds.length
    for (const c of cluster) c.lanes = n
    out.push(...cluster)
    cluster = []
    laneEnds = []
  }
  for (const b of sorted) {
    if (b.start_min >= clusterEnd && cluster.length) flush()
    let lane = laneEnds.findIndex((end) => end <= b.start_min)
    if (lane === -1) lane = laneEnds.push(0) - 1
    laneEnds[lane] = b.end_min
    cluster.push({ block: b, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, b.end_min)
  }
  flush()
  return out
}

export default function TimeBlocksPage() {
  const [date, setDate] = useState(todayStr())
  const [blocks, setBlocks] = useState<TimeBlock[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    Promise.all([api.get<TimeBlock[]>(`/blocks?from=${date}&to=${date}`), api.get<Task[]>('/tasks')])
      .then(([b, t]) => {
        setBlocks(b)
        setTasks(t)
        setError(null)
      })
      .catch((e) => setError(e.message))
  }, [date])
  useEffect(load, [load])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // 처음 열 때 오전 7시 근처로 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7 * HOUR_PX - 8 })
  }, [])

  const minFromPointer = (e: PointerEvent) => {
    const rect = gridRef.current!.getBoundingClientRect()
    const raw = (e.clientY - rect.top) / PX_PER_MIN
    return Math.max(0, Math.min(1440, Math.round(raw / SNAP) * SNAP))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return
    const m = Math.min(minFromPointer(e), 1440 - SNAP)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ anchor: m, current: m + SNAP * 2 })
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag) setDrag({ ...drag, current: minFromPointer(e) })
  }
  const onPointerUp = () => {
    if (!drag) return
    let start = Math.min(drag.anchor, drag.current)
    let end = Math.max(drag.anchor, drag.current)
    if (end - start < SNAP) {
      // 클릭만 한 경우 1시간 블록
      start = drag.anchor
      end = Math.min(1440, start + 60)
    }
    setDrag(null)
    setDraft({ date, start_min: start, end_min: end, title: '', category: 'work', task_id: null })
  }

  const laid = useMemo(() => layoutBlocks(blocks), [blocks])
  const summary = useMemo(() => {
    const m = new Map<Category, number>()
    for (const b of blocks) m.set(b.category, (m.get(b.category) ?? 0) + b.end_min - b.start_min)
    return CATEGORIES.filter((c) => m.has(c)).map((c) => ({ category: c, minutes: m.get(c)! }))
  }, [blocks])
  const total = summary.reduce((s, x) => s + x.minutes, 0)
  const openTasks = tasks.filter((t) => !t.done)
  const isToday = date === todayStr()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const blockFromTask = (t: Task) => {
    const startBase = isToday ? Math.ceil(nowMin / SNAP) * SNAP : 9 * 60
    const start = Math.min(startBase, 1440 - 60)
    setDraft({ date, start_min: start, end_min: start + 60, title: t.title, category: 'work', task_id: t.id })
  }

  const shift = (days: number) => setDate(toDateStr(addDays(parseDate(date), days)))
  const dragRange = drag && { start: Math.min(drag.anchor, drag.current), end: Math.max(drag.anchor, drag.current) }

  return (
    <div>
      <PageHeader title={fmt(parseDate(date), 'M월 d일 (EEE)')} description={isToday ? '오늘의 시간 계획' : '타임 블록'}>
        <div className="flex items-center rounded-control border border-line bg-surface p-0.5 shadow-card">
          <button className="btn-ghost btn-icon min-h-9" onClick={() => shift(-1)} aria-label="이전 날">
            <ChevronLeft />
          </button>
          <button className="btn-ghost min-h-9 px-3" onClick={() => setDate(todayStr())}>
            오늘
          </button>
          <button className="btn-ghost btn-icon min-h-9" onClick={() => shift(1)} aria-label="다음 날">
            <ChevronRight />
          </button>
        </div>
        <input type="date" className="input w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="날짜 선택" />
        <button
          className="btn-primary"
          onClick={() => {
            const s = isToday ? Math.min(Math.ceil(nowMin / SNAP) * SNAP, 1380) : 540
            setDraft({ date, start_min: s, end_min: s + 60, title: '', category: 'work', task_id: null })
          }}
        >
          <PlusIcon /> 블록
        </button>
      </PageHeader>

      {error && <p className="alert-error mb-4">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          <p className="flex items-center gap-2 border-b border-line bg-surface-muted px-4 py-2.5 text-xs text-ink-muted">
            <span aria-hidden="true">💡</span>빈 곳을 드래그해서 블록을 만들고, 블록을 누르면 수정합니다.
          </p>
          <div ref={scrollRef} className="h-[65vh] overflow-y-auto">
            <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
              {/* 시간 눈금 */}
              <div className="w-14 shrink-0 select-none">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="relative text-right text-[11px] text-ink-subtle" style={{ height: HOUR_PX }}>
                    <span className="absolute -top-2 right-2">{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</span>
                  </div>
                ))}
              </div>
              {/* 그리드 */}
              <div
                ref={gridRef}
                className="relative flex-1 cursor-crosshair touch-none border-l border-line"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDrag(null)}
                style={{
                  backgroundImage: `linear-gradient(to bottom, var(--color-line) 1px, transparent 1px), linear-gradient(to bottom, var(--color-surface-muted) 1px, transparent 1px)`,
                  backgroundSize: `100% ${HOUR_PX}px, 100% ${HOUR_PX / 2}px`,
                }}
              >
                {laid.map(({ block: b, lane, lanes }) => {
                  const color = COLOR_HEX[CATEGORY_INFO[b.category].color]
                  const height = (b.end_min - b.start_min) * PX_PER_MIN
                  return (
                    <button
                      key={b.id}
                      onClick={() => setDraft(b)}
                      className="absolute cursor-pointer overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs shadow-card transition duration-150 hover:shadow-raised hover:brightness-[0.98]"
                      style={{
                        top: b.start_min * PX_PER_MIN + 1,
                        height: height - 2,
                        left: `calc(${(lane / lanes) * 100}% + 4px)`,
                        width: `calc(${100 / lanes}% - 8px)`,
                        borderColor: color,
                        background: `color-mix(in oklab, ${color} 14%, var(--color-surface))`,
                      }}
                    >
                      <div className="truncate font-semibold text-ink">{b.title}</div>
                      {height > 30 && (
                        <div className="truncate text-ink-muted">
                          {minToTime(b.start_min)}–{minToTime(b.end_min)} · {CATEGORY_INFO[b.category].label}
                        </div>
                      )}
                    </button>
                  )
                })}

                {dragRange && (
                  <div
                    className="pointer-events-none absolute inset-x-1 rounded-lg border-2 border-dashed border-brand bg-brand-soft px-2 py-1 text-xs font-medium text-brand-ink"
                    style={{ top: dragRange.start * PX_PER_MIN, height: Math.max(dragRange.end - dragRange.start, SNAP) * PX_PER_MIN }}
                  >
                    {minToTime(dragRange.start)}–{minToTime(Math.max(dragRange.end, dragRange.start + SNAP))}
                  </div>
                )}

                {isToday && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowMin * PX_PER_MIN }}>
                    <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-danger" />
                    <span className="h-0.5 flex-1 bg-danger" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-4">
            <h2 className="section-title mb-3 flex items-baseline justify-between">
              하루 요약 <span className="text-sm font-normal text-ink-muted">{formatDuration(total)}</span>
            </h2>
            {summary.length === 0 ? (
              <p className="rounded-control bg-surface-muted py-5 text-center text-sm text-ink-subtle">계획한 블록이 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {summary.map((s) => (
                  <li key={s.category} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ background: COLOR_HEX[CATEGORY_INFO[s.category].color] }} />
                    <span className="flex-1">{CATEGORY_INFO[s.category].label}</span>
                    <span className="text-ink-muted tabular-nums">{formatDuration(s.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h2 className="section-title mb-1">할 일 → 블록</h2>
            <p className="mb-3 text-xs text-ink-muted">할 일을 누르면 그 할 일에 연결된 블록을 만듭니다.</p>
            {openTasks.length === 0 ? (
              <p className="rounded-control bg-surface-muted py-5 text-center text-sm text-ink-subtle">남은 할 일이 없습니다</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {openTasks.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => blockFromTask(t)} className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-control px-2 py-2 text-left text-sm transition hover:bg-surface-hover">
                      <span className="text-ink-subtle">＋</span>
                      <span className="flex-1 truncate">{t.title}</span>
                      {t.due_date && <span className="text-xs text-ink-subtle">{fmt(parseDate(t.due_date), 'M/d')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {draft && (
        <BlockModal
          draft={draft}
          tasks={openTasks}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function BlockModal({
  draft,
  tasks,
  onClose,
  onSaved,
}: {
  draft: Draft
  tasks: Task[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(draft.title ?? '')
  const [category, setCategory] = useState<Category>(draft.category ?? 'work')
  const [start, setStart] = useState(minToTime(draft.start_min))
  const [end, setEnd] = useState(minToTime(draft.end_min % 1440)) // 1440(자정)은 00:00으로 표시
  const [taskId, setTaskId] = useState(draft.task_id ?? '')
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const start_min = timeToMin(start)
    const endRaw = timeToMin(end)
    const end_min = endRaw === 0 ? 1440 : endRaw // 00:00 종료 = 자정
    if (end_min <= start_min) return setError('종료 시각은 시작 시각보다 뒤여야 합니다.')
    const body = { date: draft.date, title, category, start_min, end_min, task_id: taskId || null }
    try {
      if (draft.id) await api.patch(`/blocks/${draft.id}`, body)
      else await api.post('/blocks', body)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const remove = async () => {
    if (!draft.id) return
    await api.del(`/blocks/${draft.id}`)
    onSaved()
  }

  return (
    <>
    {confirmingDelete && (
      <ConfirmDialog
        title="이 블록을 삭제할까요?"
        message={`${title.trim() || '제목 없음'} · ${start}–${end}`}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    )}
    <Modal
      title={draft.id ? '블록 수정' : '새 타임 블록'}
      onClose={onClose}
      footer={
        <>
          {draft.id && (
            <button type="button" className="btn-danger" onClick={() => setConfirmingDelete(true)}>
              삭제
            </button>
          )}
          <button type="button" className="btn-ghost ml-auto" onClick={onClose}>
            취소
          </button>
          <button type="submit" form="block-form" className="btn-primary" disabled={!title.trim()}>
            저장
          </button>
        </>
      }
    >
      <form id="block-form" onSubmit={save} className="space-y-4">
        <Field label="제목">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="시작">
            <input type="time" step={900} className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="종료">
            <input type="time" step={900} className="input" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
        </div>
        <Field label="카테고리">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition duration-150 ${
                  category === c ? 'border-ink bg-ink text-white' : 'border-line hover:bg-surface-hover'
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
