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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-xl text-c-red" aria-hidden="true">
          !
        </div>
        <h2 id="confirm-title" className="text-base font-semibold">
          {title}
        </h2>
        {message && (
          <p id="confirm-message" className="mt-2 text-sm text-stone-500">
            {message}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-[#b42f2f]">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button ref={cancelRef} type="button" className="btn-ghost border border-stone-200" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button type="button" className="btn-primary btn-destructive" onClick={confirm} disabled={busy}>
            {busy ? '삭제 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
