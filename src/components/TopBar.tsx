import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmt } from '../lib/date'
import { notifyDataChanged, quickAddDate } from '../lib/quickAdd'
import { EventModal } from './EventModal'
import { CalendarIcon, CheckIcon, PlusIcon } from './Icons'
import { NewTaskModal } from './NewTaskModal'

/**
 * 날짜 인사말 — 페이지를 열 때마다 하나를 무작위로 고릅니다.
 * d: '2026년 11월 25일 수요일' (연 · 월 · 일 · 요일이 반드시 포함되도록 날짜를 통째로 넣음)
 * 문장을 추가 · 수정하려면 이 목록만 고치면 됩니다.
 */
const GREETINGS: ((d: ReactNode) => ReactNode)[] = [
  (d) => <>오늘은 {d}이에요</>,
  (d) => <>반가워요! 오늘은 {d}입니다</>,
  (d) => <>{d}, 오늘도 좋은 하루 보내세요</>,
  (d) => <>{d}, 오늘 하루도 힘내요!</>,
  (d) => <>어서 오세요, 오늘은 {d}이에요</>,
  (d) => <>{d}, 차근차근 하나씩 해봐요</>,
  (d) => <>{d}의 계획을 세워볼까요?</>,
  (d) => <>오늘은 {d}, 멋진 하루가 될 거예요</>,
  (d) => <>{d}, 오늘도 한 걸음씩 나아가요</>,
  (d) => <>다시 만나서 반가워요. 오늘은 {d}입니다</>,
]

/**
 * 모든 페이지 위쪽에 고정되는 바 — 왼쪽: 날짜 인사말, 오른쪽: + 추가 (일정 / 할 일)
 */
export function TopBar() {
  const [now, setNow] = useState(() => new Date())
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)])
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
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-3 py-2">
          <p className="flex min-w-0 items-center gap-2 text-sm leading-snug text-ink-muted sm:text-[15px]">
            <span className="shrink-0 text-brand">
              <CalendarIcon />
            </span>
            <span className="min-w-0 line-clamp-2">
              {greeting(
                <time dateTime={fmt(now, 'yyyy-MM-dd')} className="font-bold whitespace-nowrap text-ink">
                  {fmt(now, 'yyyy년 M월 d일 EEEE')}
                </time>,
              )}
            </span>
          </p>

          <div ref={wrapRef} className="relative" data-tour="quick-add">
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
