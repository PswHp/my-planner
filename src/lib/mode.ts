import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

/**
 * 라이트 / 다크 모드
 * - 저장: localStorage('dailumi:mode'). 저장된 값이 없으면 기기 설정(prefers-color-scheme)을 따릅니다.
 * - 첫 화면 깜빡임 방지: public/theme-init.js 가 화면을 그리기 전에 같은 규칙으로 먼저 적용합니다.
 * - 전환: View Transitions API로 원형 전환(지원하지 않거나 '동작 줄이기' 설정이면 즉시 전환)
 */
export type Mode = 'light' | 'dark'
const KEY = 'dailumi:mode'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function readSaved(): Mode | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

let current: Mode = readSaved() ?? (darkQuery().matches ? 'dark' : 'light')
let switching = false
const listeners = new Set<() => void>()

/** 주소창 색(theme-color)을 현재 배경색에 맞춤 */
export function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
  if (meta && bg) meta.content = bg
}

function apply(mode: Mode) {
  const root = document.documentElement
  if (mode === 'dark') root.dataset.mode = 'dark'
  else delete root.dataset.mode
  syncThemeColor()
}

/** 앱 시작 시 1회 — 현재 모드 적용 + 저장값이 없을 때는 기기 설정 변경을 따라감 */
export function initMode() {
  apply(current)
  darkQuery().addEventListener('change', (e) => {
    if (readSaved()) return
    current = e.matches ? 'dark' : 'light'
    apply(current)
    listeners.forEach((l) => l())
  })
}

export function useMode(): Mode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

/** 전환 애니메이션이 진행 중인지 (빠른 반복 조작 방지) */
export const isModeSwitching = () => switching

/** 모드 전환 (인자 없으면 반대로) */
export function switchMode(next?: Mode) {
  if (switching) return
  const target = next ?? (current === 'dark' ? 'light' : 'dark')
  if (target === current) return
  try {
    localStorage.setItem(KEY, target)
  } catch {
    /* 저장 불가 — 이번 방문에만 적용 */
  }

  const commit = () => {
    current = target
    apply(target)
    flushSync(() => listeners.forEach((l) => l()))
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || typeof document.startViewTransition !== 'function') {
    commit()
    return
  }

  switching = true
  const root = document.documentElement
  root.dataset.vt = target === 'dark' ? 'to-dark' : 'to-light'
  const vt = document.startViewTransition(commit)
  vt.finished.finally(() => {
    delete root.dataset.vt
    switching = false
  })
}
