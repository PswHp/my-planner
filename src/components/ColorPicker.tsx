import { COLORS, COLOR_HEX, type Color } from '../lib/api'

const NAMES: Record<Color, string> = {
  blue: '파랑',
  orange: '주황',
  aqua: '청록',
  yellow: '노랑',
  magenta: '분홍',
  green: '초록',
  violet: '보라',
  red: '빨강',
}

export function ColorPicker({ value, onChange }: { value: Color; onChange: (c: Color) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="색상">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={NAMES[c]}
          title={NAMES[c]}
          onClick={() => onChange(c)}
          className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full ring-offset-2 ring-offset-surface transition duration-150 hover:scale-110 ${
            value === c ? 'ring-2 ring-ink' : ''
          }`}
          style={{ background: COLOR_HEX[c] }}
        >
          {value === c && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12 5 5 9-10" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}
