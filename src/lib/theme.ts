/**
 * 테마 색 — 실제 색 값은 src/index.css 의 :root[data-theme='...'] 블록에 있습니다.
 * 선택한 테마는 이 기기(브라우저)에만 저장됩니다 (서버/DB 저장 없음).
 * 테마를 추가하려면: ① index.css에 색 블록 추가 ② 아래 THEMES에 항목 추가
 */
import { syncThemeColor } from './mode'

export const THEMES = [
  { id: 'warm', label: '웜 뉴트럴', desc: '아이보리 + 멀티컬러', swatch: ['#e7b782', '#8dabc4', '#765ea6'], bg: '#faf8f5' },
  { id: 'forest', label: '숲', desc: '차분한 초록', swatch: ['#6bb16d', '#e4f2dc', '#4e7c59'], bg: '#f7f8f3' },
  { id: 'sky', label: '하늘', desc: '맑은 파랑', swatch: ['#6aa5dc', '#e1edf9', '#3a6ea5'], bg: '#f4f7fa' },
  { id: 'lavender', label: '라벤더', desc: '은은한 보라', swatch: ['#9b8ad8', '#ece7fa', '#6a58a6'], bg: '#f7f6fa' },
  { id: 'peach', label: '복숭아', desc: '따뜻한 코랄', swatch: ['#f0927a', '#fde9e2', '#b0503a'], bg: '#faf6f3' },
  { id: 'mono', label: '모노', desc: '깔끔한 회색', swatch: ['#8a9096', '#eceef0', '#45494d'], bg: '#f5f5f4' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']
const KEY = 'dailumi:theme'
const DEFAULT: ThemeId = 'warm'

const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v)

export function getTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY)
    return isTheme(v) ? v : DEFAULT
  } catch {
    return DEFAULT
  }
}

/** 화면에 적용 (+ 저장) */
export function applyTheme(id: ThemeId, save = true) {
  const root = document.documentElement
  if (id === DEFAULT) delete root.dataset.theme
  else root.dataset.theme = id
  syncThemeColor()
  if (!save) return
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* 저장 불가(사생활 보호 모드 등) — 이번 방문에만 적용 */
  }
}
