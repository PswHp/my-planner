import { useEffect, useRef, useState } from 'react'
import { fmt } from '../lib/date'
import { notifyDataChanged, quickAddDate } from '../lib/quickAdd'
import { EventModal } from './EventModal'
import { CalendarIcon, CheckIcon, PlusIcon } from './Icons'
import { NewTaskModal } from './NewTaskModal'

/**
 * 모든 페이지 위쪽에 고정되는 바 — 왼쪽: 오늘 날짜, 오른쪽: + 추가 (일정 / 할 일)
 */
export function TopBar() {
  const [now, setNow] = useState(() => new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const [adding, setAdding] = useState<{ kind: 'event' | 'task'; date: string } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 자정이 지나면 날짜가 바뀌도록 1분마다 갱신
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  // 메뉴: 바깥 클릭 · Esc로 닫기, 열리면 첫 항목에 포커스
  useEffect(() => {
    if (!menuOpen) return
    wrapRef.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const start = (kind: 'event' | 'task') => {
    setMenuOpen(false)
    setAdding({ kind, date: quickAddDate() })
  }
  const done = () => {
    setAdding(null)
    notifyDataChanged()
  }

  const item =
    'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left text-sm font-medium text-ink transition hover:bg-surface-hover focus-visible:bg-surface-hover'

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line/70 bg-bg/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:mb-6 md:px-8">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
            <span className="text-brand">
              <CalendarIcon />
            </span>
            <time dateTime={fmt(now, 'yyyy-MM-dd')} className="truncate">
              {fmt(now, 'M월 d일 EEEE')}
            </time>
            <span className="hidden rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-muted sm:inline">
              오늘
            </span>
          </p>

          <div ref={wrapRef} className="relative">
            <button
              type="button"
              className="btn-primary min-h-10 rounded-full pr-4 pl-3"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <PlusIcon /> 추가
            </button>
            {menuOpen && (
              <div
                role="menu"
                aria-label="추가하기"
                className="absolute top-full right-0 mt-2 w-48 animate-pop-in rounded-card border border-line bg-surface p-1.5 shadow-pop"
              >
                <button type="button" role="menuitem" className={item} onClick={() => start('event')}>
                  <span className="text-point-orange-ink">
                    <CalendarIcon />
                  </span>
                  일정 추가
                </button>
                <button type="button" role="menuitem" className={item} onClick={() => start('task')}>
                  <span className="text-point-blue-ink">
                    <CheckIcon />
                  </span>
                  할 일 추가
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {adding?.kind === 'event' && (
        <EventModal
          initial={{
            title: '',
            start_at: `${adding.date}T09:00`,
            end_at: `${adding.date}T10:00`,
            all_day: 0,
            color: 'blue',
            description: '',
          }}
          onClose={() => setAdding(null)}
          onSaved={done}
        />
      )}
      {adding?.kind === 'task' && <NewTaskModal date={adding.date} onClose={() => setAdding(null)} onSaved={done} />}
    </>
  )
}
