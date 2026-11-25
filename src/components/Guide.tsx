import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GUIDE_STEPS, placeCard, spotlightBox, visibleSteps, type Box } from '../lib/guide'

const DIM = 'color-mix(in srgb, var(--color-scrim) 55%, transparent)'
const BLUR = 'fixed backdrop-blur-[3px]'

/** 화면에 실제로 보이는 data-tour 요소 (같은 이름이 여러 개면 보이는 것 — 예: 데스크톱 사이드바 / 모바일 하단 메뉴) */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)

/**
 * 사용법 안내 (스포트라이트 투어)
 * 안내하는 요소만 밝게 두고 나머지 화면은 어둡고 흐리게 가립니다. 안내 중에는 뒤 화면을 누르거나 포커스할 수 없습니다.
 * 키보드: → 다음, ← 이전, Esc 닫기
 */
export function Guide({ onClose }: { onClose: () => void }) {
  // 지금 화면에 보이는 단계만 (열 때 한 번 정함)
  const [steps] = useState(() => visibleSteps(GUIDE_STEPS, (t) => !!findTarget(t)))
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [cardH, setCardH] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const step = steps[index]
  const last = index === steps.length - 1
  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1))
  const prev = () => setIndex((i) => Math.max(i - 1, 0))

  // 뒤 화면 막기 + 키보드
  useEffect(() => {
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
      } else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root?.removeAttribute('inert')
      window.removeEventListener('keydown', onKey)
    }
  }, [steps.length])

  // 단계가 바뀌면 그 요소가 보이도록 스크롤하고, 주 버튼에 포커스
  useEffect(() => {
    const el = step.target ? findTarget(step.target) : null
    el?.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' })
    primaryRef.current?.focus()
  }, [step])

  // 강조 위치를 계속 따라감 (스크롤 · 화면 크기 변경 · 데이터가 늦게 와서 배치가 바뀌는 경우)
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const r = step.target ? findTarget(step.target)?.getBoundingClientRect() : undefined
      const nextBox = r ? spotlightBox(r) : null
      setBox((prevBox) => (sameBox(prevBox, nextBox) ? prevBox : nextBox))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [step])

  // 카드 높이를 재서 위치 계산에 씀 (그리기 전에)
  useLayoutEffect(() => {
    setCardH(cardRef.current?.offsetHeight ?? 0)
  }, [index])

  // 카드 위치: 강조 영역 아래 → 위 → (둘 다 자리가 없으면) 화면 아래쪽
  const cardPos = placeCard(box, cardH, window.innerWidth, window.innerHeight)

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      {box ? (
        <>
          {/* 강조 영역 바깥 흐리게 (위 · 아래 · 왼쪽 · 오른쪽) — 스크롤 중 어긋나지 않게 애니메이션 없이 매 프레임 따라감 */}
          <div className={`${BLUR} inset-x-0 top-0`} style={{ height: Math.max(0, box.top) }} />
          <div className={`${BLUR} inset-x-0 bottom-0`} style={{ top: box.top + box.height }} />
          <div className={`${BLUR} left-0`} style={{ top: box.top, height: box.height, width: Math.max(0, box.left) }} />
          <div className={`${BLUR} right-0`} style={{ top: box.top, height: box.height, left: box.left + box.width }} />
          {/* 강조 영역: 테두리 + 바깥을 어둡게 (안쪽은 눌러도 반응하지 않음) */}
          <div
            className="fixed rounded-[16px] outline-2 outline-brand"
            style={{ ...box, boxShadow: `0 0 0 9999px ${DIM}` }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div className={`${BLUR} inset-0`} style={{ background: DIM }} />
      )}

      <div
        key={index}
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        aria-describedby="guide-body"
        className={`fixed animate-pop-in rounded-sheet bg-surface p-5 shadow-pop ${cardH ? '' : 'invisible'}`}
        style={cardPos}
      >
        <p className="text-xs font-semibold text-brand-ink">
          {index + 1} / {steps.length}
        </p>
        <h2 id="guide-title" className="mt-1 text-base font-bold">
          {step.title}
        </h2>
        <p id="guide-body" className="mt-1.5 text-sm leading-relaxed break-keep text-ink-muted">
          {step.body}
        </p>

        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-brand' : 'w-1.5 bg-line-strong'}`} />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {!last && (
            <button type="button" className="btn-ghost -ml-2" onClick={onClose}>
              건너뛰기
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button type="button" className="btn-secondary" onClick={prev}>
                이전
              </button>
            )}
            <button ref={primaryRef} type="button" className="btn-primary" onClick={last ? onClose : next}>
              {last ? '시작하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
