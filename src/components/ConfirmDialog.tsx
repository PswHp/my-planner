import { useEffect, useRef, useState } from 'react'

interface Props {
  title: string
  message?: string
  confirmLabel?: string
  /** 확인 시 실행. Promise를 반환하면 끝날 때까지 버튼이 비활성화됨 */
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

/** 화면 중앙에 뜨는 확인 대화상자 (삭제 등 되돌릴 수 없는 작업용) */
export function ConfirmDialog({ title, message, confirmLabel = '삭제', onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // 실수로 Enter를 눌러 삭제되지 않도록 '취소'에 포커스
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

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-scrim/45 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
        className="w-full max-w-sm animate-pop-in rounded-sheet bg-surface p-6 text-center shadow-pop"
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-danger-soft text-danger" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </div>
        <h2 id="confirm-title" className="text-base font-semibold">
          {title}
        </h2>
        {message && (
          <p id="confirm-message" className="mt-1.5 text-sm break-words text-ink-muted">
            {message}
          </p>
        )}
        {error && <p className="alert-error mt-3">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button ref={cancelRef} type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button type="button" className="btn-danger-solid" onClick={confirm} disabled={busy}>
            {busy ? '삭제 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
