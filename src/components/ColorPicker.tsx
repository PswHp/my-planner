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
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="색상">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={NAMES[c]}
          title={NAMES[c]}
          onClick={() => onChange(c)}
          className={`h-7 w-7 cursor-pointer rounded-full ring-offset-2 transition ${value === c ? 'ring-2 ring-stone-800' : ''}`}
          style={{ background: COLOR_HEX[c] }}
        />
      ))}
    </div>
  )
}
