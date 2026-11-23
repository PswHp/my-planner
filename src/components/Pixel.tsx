import { useId } from 'react'

/* ==========================================================================
   픽셀 아트 — 이미지 파일 없이 문자 격자로 그리는 SVG 스프라이트
   - rows: 한 줄이 한 픽셀 행, '.' 은 투명
   - palette: 문자 → 색
   향후 동물 수집/꾸미기 기능에서 스프라이트를 추가할 때 이 형식을 그대로 쓰면 됩니다.
   ========================================================================== */
type Palette = Record<string, string>
interface Sprite {
  rows: string[]
  palette: Palette
}

function runs(rows: string[], palette: Palette, scale = 1) {
  const rects: React.JSX.Element[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      if (!palette[c]) {
        x++
        continue
      }
      let end = x
      while (end < row.length && row[end] === c) end++
      rects.push(<rect key={`${x}-${y}`} x={x * scale} y={y * scale} width={(end - x) * scale} height={scale} fill={palette[c]} />)
      x = end
    }
  })
  return rects
}

/** 스프라이트 1개를 그립니다. scale = 픽셀 1칸의 화면 크기(px) */
export function PixelArt({ sprite, scale = 4, className, label }: { sprite: Sprite; scale?: number; className?: string; label?: string }) {
  const h = sprite.rows.length
  const w = Math.max(...sprite.rows.map((r) => r.length))
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      shapeRendering="crispEdges"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {runs(sprite.rows, sprite.palette)}
    </svg>
  )
}

/** 가로로 반복되는 픽셀 띠 (잔디 등) — 너비 100% */
export function PixelStrip({ sprite, scale = 3, className }: { sprite: Sprite; scale?: number; className?: string }) {
  const id = useId()
  const h = sprite.rows.length
  const w = Math.max(...sprite.rows.map((r) => r.length))
  return (
    <svg width="100%" height={h * scale} className={className} shapeRendering="crispEdges" aria-hidden="true">
      <defs>
        <pattern id={id} width={w * scale} height={h * scale} patternUnits="userSpaceOnUse">
          {runs(sprite.rows, sprite.palette, scale)}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/* --------------------------------------------------------------------------
   스프라이트 모음
-------------------------------------------------------------------------- */
const OUTLINE = '#4a3b36'

/** 고양이 (기본 동물 — 디자인 미리보기용) */
export const CAT: Sprite = {
  palette: {
    k: OUTLINE,
    w: '#ffffff',
    g: '#9a8a80',
    p: '#f4a7b6',
    r: '#e0574f',
    R: '#b8433c',
  },
  rows: [
    '...kk..........kk....',
    '..kggk........kwwk...',
    '..kgpgk......kwpwk...',
    '..kggggkkkkkkwwwwk...',
    '.kgggggwwwwwwwwwwwk..',
    '.kgggggwwwwwwwwwwwk..',
    'kwwgggwwwwwwwwwwwwwk.',
    'kwwwwwwwwwwwwwwwwwwk.',
    'kwwwkkwwwwwwwwkkwwwk.',
    'kwwwkkwwwwwwwwkkwwwk.',
    'kwppwwwwwkkwwwwwppwk.',
    '.kwwwwwwwwwwwwwwwwk..',
    '..kkwwwwwwwwwwwwkk...',
    '...krrrrrrrrrrrrk....',
    '..kwwwrRRwwwwwwwwk...',
    '..kwwwwRwwwwwwwwwk.kk',
    '..kwwwwwwwwwwwwwwkkgk',
    '..kwwkwwwwwwkwwwwkgk.',
    '..kwwkwwwwwwkwwwwkk..',
    '...kkkkkkkkkkkkkk....',
  ],
}

/** 발바닥 (로고 · 파비콘) */
export const PAW: Sprite = {
  palette: { k: '#5a4640', p: '#f7b5c3', w: '#ffffff' },
  rows: [
    '...kk...kk...',
    '..kppk.kppk..',
    '..kppk.kppk..',
    '...kk...kk...',
    '.kk..kkk..kk.',
    'kppkkwwwkkppk',
    'kppkwwpwwkppk',
    '.kkkwpppwkkk.',
    '..kwpppppwk..',
    '..kwwpppwwk..',
    '...kwwwwwk...',
    '....kkkkk....',
  ],
}

export const HEART: Sprite = {
  palette: { h: '#f07c95', l: '#ffd1dc' },
  rows: ['.hh.hh.', 'hlhhhhh', 'hhhhhhh', '.hhhhh.', '..hhh..', '...h...'],
}

export const TREE: Sprite = {
  palette: {
    L: '#8fca7a',
    l: '#b5e0a0',
    D: '#5f9f58',
    t: '#9b6b45',
    T: '#7d5433',
  },
  rows: [
    '.....LLLLLL.....',
    '...LLLlLLLLLL...',
    '..LLlllLLLLLLL..',
    '.LLllLLLLLLDLLL.',
    '.LLLLLLLLLDDLLL.',
    'LLLLLLlLLLLLLLDL',
    'LLLLLlllLLLLLDDL',
    'LLLLLLlLLLLLLDDL',
    '.LLDLLLLLLLDDDL.',
    '.LDDDLLLLLDDDDL.',
    '..LDDDDDDDDDDL..',
    '....DDDttDDD....',
    '.......tt.......',
    '.......tt.......',
    '......tTtt......',
    '.....tt..tt.....',
  ],
}

export const BUSH: Sprite = {
  palette: { g: '#a8d58f', G: '#7fbf6a' },
  rows: ['...gggg...', '.gGGggGgg.', 'gGGgGGGGgg', 'gGGGGGGGGg'],
}

export const FLOWER: Sprite = {
  palette: { y: '#f6d365', o: '#f19a3e', g: '#7fbf6a' },
  rows: ['.y.y.', 'yyoyy', '.yyy.', '..g..', '.gg.g', '..gg.', '..g..'],
}

export const FLOWER_PINK: Sprite = {
  ...FLOWER,
  palette: { ...FLOWER.palette, y: '#f4a7b6', o: '#fff3c4' },
}

export const CLOUD: Sprite = {
  palette: { w: '#ffffff' },
  rows: ['...www....', '.wwwwwww..', 'wwwwwwwwww', '.wwwwwwww.'],
}

/** 화분 새싹 (주간 진행률) */
export const SPROUT: Sprite = {
  palette: {
    L: '#8fca7a',
    l: '#b5e0a0',
    g: '#5f9f58',
    t: '#c69a6d',
    T: '#a77b52',
  },
  rows: ['.LL...LL.', 'LlLL.LLlL', '.LLLgLLL.', '....g....', '....g....', '.ttttttt.', '.tTTTTTt.', '..tTTTt..', '..ttttt..'],
}

/** 돌 위 새싹 (연속 달성) */
export const MOUND: Sprite = {
  palette: {
    L: '#8fca7a',
    l: '#b5e0a0',
    g: '#5f9f58',
    d: '#cdb894',
    D: '#ab9670',
  },
  rows: [
    '......LL......',
    '.....LlL.LL...',
    '......LgLlL...',
    '.......g.L....',
    '.......g......',
    '....dddddd....',
    '..dddDDddddd..',
    '.ddDDddddDDdd.',
    'dddddddddddddd',
  ],
}

/** 잔디 띠 (반복용 타일) */
export const GRASS: Sprite = {
  palette: { g: '#b5dc9c', G: '#8cc775', D: '#76b264' },
  rows: ['...g.......g....', '..gGg..g..gGg...', '.gGGg.gGg.gGGg.g', 'gGGGGgGGGgGGGGgG', 'GGGGGGGGGGGGGGGG', 'DDDDDDDDDDDDDDDD'],
}

/** 서비스 로고 (발바닥 + Dailumi) */
export function Logo({ compact = false, subtitle = false }: { compact?: boolean; subtitle?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-surface-muted ring-1 ring-line">
        <PixelArt sprite={PAW} scale={2.2} />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block text-[19px] font-extrabold tracking-tight text-brand">Dailumi</span>
          {subtitle && <span className="mt-0.5 block text-[11px] leading-snug text-ink-subtle">동물 친구와 함께하는 게임형 플래너</span>}
        </span>
      )}
    </span>
  )
}
