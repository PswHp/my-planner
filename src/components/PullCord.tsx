import { useRef, useState, type PointerEvent } from 'react'
import { isModeSwitching, switchMode, useMode } from '../lib/mode'

/** 줄 기본 길이 · 최대로 늘어나는 길이 · 전환에 필요한 거리 (px) */
const REST = 26
const MAX = 60
const THRESHOLD = 38

/**
 * 천장에서 내려오는 전등 줄 — 아래로 당겼다 놓으면 라이트/다크 모드 전환
 * - 마우스 · 터치 모두 Pointer Events로 처리
 * - 충분히 당기지 않으면 전환 없이 탄성 있게 원위치
 * - 키보드(Enter/Space)와 화면낭독기로도 전환 가능 (role="switch")
 * 부모 요소가 position(relative/sticky 등)을 가져야 합니다.
 */
export function PullCord({ className = '' }: { className?: string }) {
  const dark = useMode() === 'dark'
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef<number | null>(null)
  const pullRef = useRef(0)

  const setPullBoth = (v: number) => {
    pullRef.current = v
    setPull(v)
  }

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault() // 드래그 중 주변 글자가 선택되지 않게 (전환 중이라 무시할 때도)
    if (e.button !== 0 || isModeSwitching()) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startY.current = e.clientY
    setDragging(true)
  }

  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (startY.current === null) return
    const raw = Math.max(0, e.clientY - startY.current)
    // 최대 길이를 넘으면 살짝 버티는 느낌
    setPullBoth(raw <= MAX ? raw : MAX + (raw - MAX) * 0.15)
  }

  const release = () => {
    if (startY.current === null) return
    startY.current = null
    setDragging(false)
    if (pullRef.current >= THRESHOLD) switchMode()
    setPullBoth(0)
  }

  // 키보드 · 보조기기 (마우스/터치 클릭은 detail > 0 이라 드래그로만 처리)
  const tug = () => {
    if (isModeSwitching()) return
    setPullBoth(THRESHOLD)
    window.setTimeout(() => {
      setPullBoth(0)
      switchMode()
    }, 140)
  }

  const ready = pull >= THRESHOLD
  const spring = dragging ? 'none' : '520ms cubic-bezier(0.34, 1.8, 0.5, 1)'

  return (
    <div className={`pointer-events-none absolute top-0 z-10 flex w-[30px] flex-col items-center ${className}`} data-tour="mode">
      {/* 천장 고정부 */}
      <span className="h-[3px] w-3 rounded-b-sm bg-line-strong" aria-hidden="true" />
      {/* 줄 */}
      <span
        className="w-[1.5px] bg-ink-subtle/60"
        style={{ height: REST + pull, transition: spring === 'none' ? 'none' : `height ${spring}` }}
        aria-hidden="true"
      />
      {/* 손잡이 */}
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="다크 모드"
        title={dark ? '줄을 당기면 라이트 모드' : '줄을 당기면 다크 모드'}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        onClick={(e) => e.detail === 0 && tug()}
        className={`pointer-events-auto -mt-0.5 grid h-8 w-[30px] touch-none place-items-start justify-center rounded-full outline-offset-0 select-none ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <span
          className={`block h-[18px] w-3 rounded-full border transition-[background-color,border-color,box-shadow,transform] duration-200 ${
            ready
              ? 'scale-110 border-brand bg-brand'
              : dark
                ? 'border-brand-accent bg-brand-soft shadow-[0_0_10px_2px] shadow-brand-accent/45'
                : 'border-line-strong bg-field shadow-card'
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
