import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { api, type DailyRewardResult } from '../lib/api'
import { CAT, PixelArt } from './Pixel'
import { ACCESSORY_SPRITES, COIN, GIFTS, UNKNOWN_ACCESSORY } from './rewardSprites'

/**
 * 일일 첫 접속 보상
 *  ① 화면 전체 어둡게 + 블러 → ② 구름 위 고양이와 안내 → ③ 선물 상자 낙하 → ④ 보상 결과
 * 추첨 · 지급은 서버(POST /api/rewards/daily)에서만 하고, 여기서는 결과만 보여줍니다.
 * 애니메이션은 transform / opacity 만 사용하며, '동작 줄이기' 사용자는 애니메이션을 건너뜁니다.
 */
type Phase = 'intro' | 'ready' | 'dropping' | 'result' | 'error'

const DROP_MS = 1500
const RARITY_LABEL = { N: '일반', R: '레어', SR: '슈퍼 레어', SSR: '스페셜' } as const
const RARITY_COLOR = {
  N: 'var(--color-rarity-n)',
  R: 'var(--color-rarity-r)',
  SR: 'var(--color-rarity-sr)',
  SSR: 'var(--color-rarity-ssr)',
} as const

/** 떨어지는 선물 상자들의 궤도 (x 이동 · 위로 튀는 높이 · 회전 · 시작 지연 · 시간) */
const FALLING = [
  { x: -150, up: -70, rot: -40, delay: 0, dur: 1150, gift: 0 },
  { x: 120, up: -90, rot: 55, delay: 60, dur: 1250, gift: 1 },
  { x: -40, up: -110, rot: -25, delay: 140, dur: 1200, gift: 2 },
  { x: 200, up: -50, rot: 70, delay: 200, dur: 1100, gift: 0 },
  { x: -230, up: -40, rot: -65, delay: 260, dur: 1150, gift: 1 },
  { x: 40, up: -130, rot: 30, delay: 320, dur: 1180, gift: 2 },
  { x: -100, up: -100, rot: 45, delay: 380, dur: 1100, gift: 1 },
]

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function DailyReward({ onDone, onLater }: { onDone: (r: DailyRewardResult) => void; onLater: () => void }) {
  const [phase, setPhase] = useState<Phase>(() => (reducedMotion() ? 'ready' : 'intro'))
  const [result, setResult] = useState<DailyRewardResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const primaryRef = useRef<HTMLButtonElement>(null)

  // ① 잠깐 '준비 중' 표시 후 ② 안내 화면
  useEffect(() => {
    if (phase !== 'intro') return
    const t = window.setTimeout(() => setPhase('ready'), 900)
    return () => window.clearTimeout(t)
  }, [phase])

  // 단계가 바뀌면 주요 버튼에 포커스 (키보드 사용자)
  useEffect(() => {
    primaryRef.current?.focus()
  }, [phase])

  // 배경 스크롤 막기
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const open = async () => {
    if (busy.current) return // 중복 클릭 방지
    busy.current = true
    setError(null)
    const animate = !reducedMotion()
    if (animate) setPhase('dropping')
    try {
      // 서버 요청과 애니메이션을 동시에 진행하고, 둘 다 끝나면 결과 표시
      const [r] = await Promise.all([
        api.post<DailyRewardResult>('/rewards/daily', {}),
        animate ? new Promise((res) => window.setTimeout(res, DROP_MS)) : null,
      ])
      setResult(r)
      setPhase('result')
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    } finally {
      busy.current = false
    }
  }

  const confirm = () => result && onDone(result)

  // Esc: 결과 화면에서는 확인, 안내 화면에서는 나중에
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (phase === 'result') confirm()
      else if (phase === 'ready' || phase === 'error') onLater()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-scrim/45 backdrop-blur-md animate-fade-in" role="presentation">
      <div className="flex min-h-full items-center justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {phase === 'intro' && (
          <p className="flex animate-fade-in flex-col items-center gap-3 text-sm font-medium text-white/90" role="status">
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="5" y="10" width="14" height="10" rx="2.5" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
            </svg>
            첫 접속 보상 준비 중…
          </p>
        )}

        {(phase === 'ready' || phase === 'dropping' || phase === 'error') && (
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reward-title"
            className="relative w-full max-w-sm animate-pop-in text-center"
          >
            <Sparkles />
            {/* 고양이 + 선물 */}
            <div className="relative z-10 mx-auto h-[130px] w-[180px]">
              <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${phase === 'dropping' ? 'animate-cat-toss' : 'animate-bob'}`}>
                <PixelArt sprite={CAT} scale={5} label="선물을 든 고양이" />
                <div
                  className={`absolute -bottom-1 left-1/2 -translate-x-[58%] transition duration-300 ${
                    phase === 'dropping' ? '-translate-y-10 scale-75 opacity-0' : ''
                  }`}
                >
                  <PixelArt sprite={GIFTS[1]} scale={3} />
                </div>
              </div>
            </div>

            {/* 구름 말풍선 */}
            <Cloud>
              <h2 id="reward-title" className="text-[22px] leading-snug font-extrabold tracking-tight text-[#3b3530] sm:text-2xl">
                오늘의 보상은
                <br />
                뭘까요?
              </h2>
              {phase === 'error' ? (
                <p className="mt-2 text-sm text-[#a33a33]">{error ?? '보상을 받지 못했어요.'}</p>
              ) : (
                <p className="mt-2 text-sm text-[#6a635b]">하루 한 번, 첫 접속 선물이 도착했어요</p>
              )}
            </Cloud>

            <div className="mt-5 flex flex-col items-center gap-2">
              <button
                ref={primaryRef}
                type="button"
                onClick={open}
                disabled={phase === 'dropping'}
                className="btn-primary min-h-12 rounded-full px-8 text-[15px] shadow-raised disabled:opacity-70"
              >
                {phase === 'dropping' ? '선물 여는 중…' : phase === 'error' ? '다시 시도' : '선물 열기'}
                {phase !== 'dropping' && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                )}
              </button>
              {phase !== 'dropping' && (
                <button
                  type="button"
                  onClick={onLater}
                  className="min-h-10 cursor-pointer px-3 text-xs font-medium text-white/80 underline-offset-2 hover:underline"
                >
                  나중에 받기
                </button>
              )}
            </div>
          </section>
        )}

        {/* ③ 선물 상자 낙하 */}
        {phase === 'dropping' && (
          <div className="pointer-events-none fixed top-[30%] left-1/2" aria-hidden="true">
            {FALLING.map((f, i) => (
              <div
                key={i}
                className="gift-fall absolute"
                style={
                  {
                    '--x': `${f.x}px`,
                    '--up': `${f.up}px`,
                    '--rot': `${f.rot}deg`,
                    '--delay': `${f.delay}ms`,
                    '--dur': `${f.dur}ms`,
                  } as CSSProperties
                }
              >
                <div className="gift-fall-y">
                  <PixelArt sprite={GIFTS[f.gift]} scale={4} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ④ 보상 결과 */}
        {phase === 'result' && result && <ResultCard result={result} onConfirm={confirm} primaryRef={primaryRef} />}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   결과 카드
-------------------------------------------------------------------------- */
function ResultCard({
  result,
  onConfirm,
  primaryRef,
}: {
  result: DailyRewardResult
  onConfirm: () => void
  primaryRef: React.RefObject<HTMLButtonElement | null>
}) {
  const { accessory, duplicate, coins, baseCoins, totalCoins } = result
  const color = RARITY_COLOR[accessory.rarity] ?? RARITY_COLOR.N
  const sprite = ACCESSORY_SPRITES[accessory.id] ?? UNKNOWN_ACCESSORY
  const high = accessory.rarity === 'SR' || accessory.rarity === 'SSR'

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="reward-result-title"
      className="relative w-full max-w-sm animate-pop-in rounded-sheet bg-surface px-6 pt-12 pb-6 text-center shadow-pop"
      style={{ '--rarity': color } as CSSProperties}
    >
      <button type="button" onClick={onConfirm} className="btn-ghost btn-icon absolute top-3 right-3 rounded-full" aria-label="닫기">
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

      {/* 리본 배너 */}
      <h2
        id="reward-result-title"
        className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-control bg-point-orange px-5 py-2 text-[15px] font-extrabold whitespace-nowrap text-[#3b2a14] shadow-raised"
      >
        <span aria-hidden="true">🎁</span> 오늘의 보상 획득!
      </h2>

      {/* 액세서리 + 등급 광채 */}
      <div className="relative mx-auto grid h-36 w-36 place-items-center">
        <span
          className={`absolute inset-0 rounded-full opacity-60 ${high ? 'animate-glow' : ''}`}
          style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--rarity) 55%, transparent) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <Confetti />
        <PixelArt sprite={sprite} scale={6} className="relative animate-reward-pop" label={accessory.name} />
      </div>

      <span
        className="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold text-white shadow-card"
        style={{ background: 'var(--rarity)' }}
      >
        {accessory.rarity} <span className="font-semibold opacity-90">· {RARITY_LABEL[accessory.rarity]}</span>
      </span>
      <p className="mt-2 text-xl font-extrabold tracking-tight">{accessory.name}</p>
      {accessory.description && <p className="mt-1 text-sm text-ink-muted">{accessory.description}</p>}

      {duplicate && (
        <p className="mt-4 rounded-control bg-point-purple-soft px-3 py-2.5 text-sm font-medium text-point-purple-ink">
          이미 보유한 액세서리예요! 대신 추가 코인을 획득했어요.
        </p>
      )}

      <div className="mt-4 flex items-center justify-center gap-2 rounded-control bg-point-orange-soft px-4 py-3 text-point-orange-ink">
        <PixelArt sprite={COIN} scale={3} />
        <span className="text-lg font-extrabold">+{coins}</span>
        <span className="text-sm font-semibold">코인</span>
        {duplicate && (
          <span className="text-xs font-medium opacity-80">
            (기본 {baseCoins} + 추가 {coins - baseCoins})
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-subtle">보유 코인 {totalCoins.toLocaleString()}</p>

      <button ref={primaryRef} type="button" onClick={onConfirm} className="btn-primary mt-5 min-h-12 w-full rounded-full text-[15px]">
        확인
      </button>
    </section>
  )
}

/* --------------------------------------------------------------------------
   장식 — ⚠️ 임시 리소스 (CSS로 그린 구름 · 반짝임 · 축하 효과)
-------------------------------------------------------------------------- */
function Cloud({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto -mt-3 w-[min(100%,20rem)]">
      {/* 뭉게구름 테두리 */}
      <span
        className="absolute -top-5 left-[14%] h-16 w-16 rounded-full bg-[#fffdfa] shadow-[0_-4px_12px_-6px_rgb(0_0_0/0.15)]"
        aria-hidden="true"
      />
      <span className="absolute -top-8 left-[36%] h-20 w-20 rounded-full bg-[#fffdfa]" aria-hidden="true" />
      <span className="absolute -top-4 right-[14%] h-14 w-14 rounded-full bg-[#fffdfa]" aria-hidden="true" />
      <div className="relative rounded-[2.5rem] bg-[#fffdfa] px-6 pt-5 pb-6 shadow-pop">{children}</div>
    </div>
  )
}

function Sparkles() {
  const items = [
    { top: '4%', left: '12%', size: 14, delay: '0s', color: '#f3d27a' },
    { top: '14%', left: '84%', size: 18, delay: '.4s', color: '#ffffff' },
    { top: '34%', left: '4%', size: 10, delay: '.9s', color: '#ffffff' },
    { top: '2%', left: '64%', size: 10, delay: '1.3s', color: '#f3d27a' },
    { top: '40%', left: '92%', size: 12, delay: '.7s', color: '#e7b782' },
  ]
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {items.map((s, i) => (
        <svg
          key={i}
          className="absolute animate-twinkle"
          style={{ top: s.top, left: s.left, animationDelay: s.delay }}
          width={s.size}
          height={s.size}
          viewBox="0 0 24 24"
        >
          <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill={s.color} />
        </svg>
      ))}
    </div>
  )
}

function Confetti() {
  const colors = ['#8dabc4', '#e7b782', '#a88cc6', '#f4a7b6', '#f3d27a']
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2
        const dist = 70 + (i % 3) * 18
        return (
          <span
            key={i}
            className="confetti absolute top-1/2 left-1/2 h-2 w-1.5 rounded-[2px]"
            style={
              {
                background: colors[i % colors.length],
                '--cx': `${Math.cos(angle) * dist}px`,
                '--cy': `${Math.sin(angle) * dist}px`,
                '--cr': `${(i % 2 ? 1 : -1) * (90 + i * 20)}deg`,
                animationDelay: `${(i % 4) * 40}ms`,
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
