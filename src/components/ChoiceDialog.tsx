import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface Choice {
  label: string
  /** primary: 주요 동작, danger: 삭제 등 위험한 동작, secondary: 보조 */
  variant: 'primary' | 'danger' | 'secondary'
  /** Promise를 반환하면 끝날 때까지 모든 버튼이 비활성화됨 */
  onSelect: () => void | Promise<void>
}

/**
 * 화면 중앙에 뜨는 선택 대화상자 — 여러 선택지 중 하나를 고를 때
 * (예: 반복 일정에서 '이 일정만' / '반복 일정 전체')
 */
export function ChoiceDialog({
  title,
  message,
  icon,
  tone = 'normal',
  choices,
  onCancel,
}: {
  title: string
  message?: ReactNode
  icon?: ReactNode
  tone?: 'normal' | 'danger'
  choices: Choice[]
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // 실수로 Enter를 눌러 실행되지 않도록 '취소'에 포커스
    cancelRef.current?.focus()
    // 캡처 단계에서 Esc를 가로채 뒤에 열린 모달까지 닫히지 않게 함
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const run = async (c: Choice) => {
    setBusy(true)
    setError(null)
    try {
      await c.onSelect()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const cls = { primary: 'btn-primary', danger: 'btn-danger-solid', secondary: 'btn-secondary' } as const

  return (
    <div
      className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-scrim/45 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="choice-title"
        aria-describedby={message ? 'choice-message' : undefined}
        className="w-full max-w-sm animate-pop-in rounded-sheet bg-surface p-6 text-center shadow-pop"
      >
        {icon && (
          <div
            className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full ${
              tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand'
            }`}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <h2 id="choice-title" className="text-base font-semibold">
          {title}
        </h2>
        {message && (
          <div id="choice-message" className="mt-1.5 text-sm break-words text-ink-muted">
            {message}
          </div>
        )}
        {error && <p className="alert-error mt-3">{error}</p>}
        <div className="mt-6 grid gap-2">
          {choices.map((c) => (
            <button key={c.label} type="button" className={`${cls[c.variant]} w-full`} onClick={() => run(c)} disabled={busy}>
              {c.label}
            </button>
          ))}
          <button ref={cancelRef} type="button" className="btn-ghost w-full" onClick={onCancel} disabled={busy}>
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
