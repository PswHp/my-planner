import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** PC(md 이상)에서 왼쪽에 함께 보여줄 패널 (예: 달력). 모바일에서는 숨김 */
  aside?: ReactNode
}

/** 입력용 모달 — 모바일에서는 바텀시트, PC에서는 중앙 카드 */
export function Modal({ title, onClose, children, footer, aside }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-scrim/35 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-sheet bg-surface shadow-pop sm:max-w-md sm:animate-pop-in sm:rounded-sheet ${
          aside ? 'md:max-w-[50rem] md:flex-row' : ''
        }`}
      >
        {aside && (
          <aside className="hidden w-[19rem] shrink-0 overflow-y-auto border-r border-line bg-surface-muted/60 p-5 md:block">{aside}</aside>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2 sm:pt-5">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button className="btn-ghost btn-icon -mr-2" onClick={onClose} aria-label="닫기">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto px-5 py-3">{children}</div>
          {footer && (
            <div className="flex shrink-0 items-center gap-2 border-t border-line px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      {children}
    </label>
  )
}
