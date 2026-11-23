import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fmt, parseDate, toDateStr, todayStr } from '../lib/date'
import { CalendarIcon, ChevronLeft, ChevronRight, ClockIcon } from './Icons'

/* ==========================================================================
   날짜 · 시간 선택 — 브라우저 기본 입력창 대신 사이트 디자인에 맞춘 선택 창
   값 형식은 기존과 동일: 날짜 'YYYY-MM-DD', 시간 'HH:mm'
   ========================================================================== */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 'YYYY-MM-DD' → '11월 23일 (월)' (올해가 아니면 연도 포함) */
export function formatDateLabel(value: string) {
  const d = parseDate(value)
  return fmt(d, d.getFullYear() === new Date().getFullYear() ? 'M월 d일 (EEE)' : 'yyyy년 M월 d일 (EEE)')
}

/** 'HH:mm' → '오후 3:30' */
export function formatTimeLabel(value: string) {
  const [h24, m] = value.split(':').map(Number)
  const h = h24 % 24 // '24:00'(자정)도 안전하게
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`
}

/* --------------------------------------------------------------------------
   선택 창 틀 — 모바일은 바텀시트, PC는 중앙 카드. 다른 모달 위에 겹쳐 뜹니다.
-------------------------------------------------------------------------- */
function PickerSheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    // 캡처 단계에서 Esc를 가로채 뒤의 일정 모달까지 닫히지 않게 함
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // body에 직접 그려서 <label> 안에서 열려도 클릭이 입력 버튼으로 다시 전달되지 않게 함
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex animate-fade-in items-end justify-center bg-scrim/35 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full animate-sheet-in rounded-t-sheet bg-surface px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-pop sm:max-w-[22rem] sm:animate-pop-in sm:rounded-sheet sm:pt-5 sm:pb-5"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
        {children}
        {footer && <div className="mt-4 grid grid-cols-2 gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** 입력창 모양의 버튼 */
function TriggerButton({
  icon,
  children,
  onClick,
  ariaLabel,
  compact = false,
  muted = false,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  ariaLabel: string
  compact?: boolean
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      className={
        compact
          ? 'flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-muted px-2.5 text-xs font-medium text-ink-muted tabular-nums transition hover:border-brand-light hover:text-ink'
          : 'input flex cursor-pointer items-center gap-2 text-left font-medium tabular-nums hover:border-brand-light'
      }
    >
      <span className={`shrink-0 text-brand ${compact ? '[&>svg]:h-4 [&>svg]:w-4' : ''}`}>{icon}</span>
      <span className={`truncate ${muted ? 'text-ink-subtle' : ''}`}>{children}</span>
    </button>
  )
}

/* --------------------------------------------------------------------------
   날짜 선택
-------------------------------------------------------------------------- */
/**
 * clearable: 값 없음('')을 허용 (예: 마감일 없음). 빈 값일 때 emptyLabel 표시
 * compact: 작은 칩 모양 (빠른 추가 줄 등)
 */
export function DateField({
  value,
  onChange,
  min,
  label,
  clearable = false,
  emptyLabel = '날짜 없음',
  compact = false,
}: {
  value: string
  onChange: (v: string) => void
  min?: string
  label: string
  clearable?: boolean
  emptyLabel?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const text = value ? formatDateLabel(value) : emptyLabel
  return (
    <>
      <TriggerButton icon={<CalendarIcon />} onClick={() => setOpen(true)} ariaLabel={`${label}: ${text}`} compact={compact} muted={!value}>
        {text}
      </TriggerButton>
      {open && (
        <DatePickerDialog
          title={label}
          value={value}
          min={min}
          clearLabel={clearable ? emptyLabel : undefined}
          onClose={() => setOpen(false)}
          onPick={(v) => {
            onChange(v)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function DatePickerDialog({
  title,
  value,
  min,
  clearLabel,
  onPick,
  onClose,
}: {
  title: string
  value: string
  min?: string
  clearLabel?: string
  onPick: (v: string) => void
  onClose: () => void
}) {
  const [month, setMonth] = useState(() => startOfMonth(value ? parseDate(value) : new Date()))
  const today = todayStr()
  const days = eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) })
  const quick: [string, string][] = [
    ['오늘', today],
    ['내일', toDateStr(addDays(new Date(), 1))],
    ['일주일 뒤', toDateStr(addDays(value ? parseDate(value) : new Date(), 7))],
  ]

  return (
    <PickerSheet title={title} onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-muted">{title}</p>
        <p className="text-sm font-bold text-brand-ink">{value ? formatDateLabel(value) : clearLabel}</p>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="btn-ghost btn-icon min-h-9 rounded-full"
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="이전 달"
        >
          <ChevronLeft />
        </button>
        <span className="text-[15px] font-bold">{fmt(month, 'yyyy년 M월')}</span>
        <button
          type="button"
          className="btn-ghost btn-icon min-h-9 rounded-full"
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="다음 달"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-semibold">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`pb-1.5 ${i === 0 ? 'text-sunday' : 'text-ink-muted'}`}>
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const ds = toDateStr(d)
          if (!isSameMonth(d, month)) return <div key={ds} />
          const isSel = ds === value
          const isToday = ds === today
          const disabled = !!min && ds < min
          return (
            <button
              key={ds}
              type="button"
              disabled={disabled}
              data-autofocus={isSel ? '' : undefined}
              onClick={() => onPick(ds)}
              aria-label={fmt(d, 'M월 d일 (EEE)')}
              aria-pressed={isSel}
              className={`mx-auto my-0.5 grid h-10 w-10 place-items-center rounded-full text-sm transition disabled:cursor-not-allowed disabled:opacity-30 ${
                isSel
                  ? 'bg-brand font-bold text-on-brand shadow-raised'
                  : isToday
                    ? 'font-bold text-brand-ink ring-2 ring-brand-accent ring-inset hover:bg-brand-soft'
                    : `font-medium hover:bg-surface-hover ${i % 7 === 0 ? 'text-sunday' : 'text-ink'}`
              }`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
        {quick.map(([label, ds]) => (
          <button
            key={label}
            type="button"
            disabled={!!min && ds < min}
            onClick={() => onPick(ds)}
            className="min-h-9 cursor-pointer rounded-full bg-surface-muted px-3.5 text-xs font-semibold text-ink-muted transition hover:bg-brand-soft hover:text-brand-ink disabled:pointer-events-none disabled:opacity-40"
          >
            {label}
          </button>
        ))}
        {clearLabel && (
          <button
            type="button"
            onClick={() => onPick('')}
            aria-pressed={!value}
            className={`ml-auto min-h-9 cursor-pointer rounded-full px-3.5 text-xs font-semibold transition ${
              value ? 'text-ink-muted ring-1 ring-line hover:bg-surface-hover' : 'bg-brand text-on-brand'
            }`}
          >
            {clearLabel}
          </button>
        )}
      </div>
    </PickerSheet>
  )
}

/* --------------------------------------------------------------------------
   시간 선택 — 오전/오후 → 시 → 분을 눌러서 고르기
-------------------------------------------------------------------------- */
export function TimeField({
  value,
  onChange,
  label,
  minuteStep = 5,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  minuteStep?: number
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <TriggerButton icon={<ClockIcon />} onClick={() => setOpen(true)} ariaLabel={`${label}: ${formatTimeLabel(value)}`}>
        {formatTimeLabel(value)}
      </TriggerButton>
      {open && (
        <TimePickerDialog
          title={label}
          value={value}
          minuteStep={minuteStep}
          onClose={() => setOpen(false)}
          onPick={(v) => {
            onChange(v)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function TimePickerDialog({
  title,
  value,
  minuteStep,
  onPick,
  onClose,
}: {
  title: string
  value: string
  minuteStep: number
  onPick: (v: string) => void
  onClose: () => void
}) {
  const [h24, m0] = value.split(':').map(Number)
  const h0 = h24 % 24
  const [pm, setPm] = useState(h0 >= 12)
  const [hour12, setHour12] = useState(h0 % 12 === 0 ? 12 : h0 % 12)
  const [minute, setMinute] = useState(m0)

  const hour24 = (hour12 % 12) + (pm ? 12 : 0)
  const result = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const minutes = Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep)
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

  const cell = (on: boolean) =>
    `grid h-10 cursor-pointer place-items-center rounded-control text-sm tabular-nums transition active:scale-95 ${
      on
        ? 'bg-brand font-bold text-on-brand shadow-raised'
        : 'bg-field font-medium text-ink ring-1 ring-line hover:bg-brand-soft hover:ring-brand-light'
    }`

  return (
    <PickerSheet
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn-primary" onClick={() => onPick(result)} data-autofocus="">
            확인
          </button>
        </>
      }
    >
      <div className="mb-3 flex items-end justify-between">
        <p className="text-xs font-semibold text-ink-muted">{title}</p>
        <p className="text-2xl font-extrabold tracking-tight text-brand tabular-nums" aria-live="polite">
          {formatTimeLabel(result)}
        </p>
      </div>

      <div className="segmented mb-4" role="tablist" aria-label="오전 / 오후">
        {(['오전', '오후'] as const).map((label, i) => (
          <button key={label} type="button" role="tab" aria-selected={pm === (i === 1)} onClick={() => setPm(i === 1)}>
            {label}
          </button>
        ))}
      </div>

      <p className="mb-1.5 text-xs font-semibold text-ink-muted">시</p>
      <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="시">
        {hours.map((h) => (
          <button key={h} type="button" className={cell(h === hour12)} aria-pressed={h === hour12} onClick={() => setHour12(h)}>
            {h}
          </button>
        ))}
      </div>

      <p className="mt-4 mb-1.5 text-xs font-semibold text-ink-muted">분</p>
      <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="분">
        {minutes.map((m) => (
          <button key={m} type="button" className={cell(m === minute)} aria-pressed={m === minute} onClick={() => setMinute(m)}>
            {String(m).padStart(2, '0')}
          </button>
        ))}
      </div>
    </PickerSheet>
  )
}
