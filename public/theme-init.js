/* 첫 화면 깜빡임 방지 — 화면을 그리기 전에 저장된 테마 색 · 다크 모드를 먼저 적용합니다.
   (규칙은 src/lib/theme.ts, src/lib/mode.ts 와 동일) */
;(function () {
  try {
    var root = document.documentElement
    var theme = localStorage.getItem('dailumi:theme')
    if (theme && /^(sky|lavender|peach|mono)$/.test(theme)) root.setAttribute('data-theme', theme)
    var mode = localStorage.getItem('dailumi:mode')
    if (mode !== 'light' && mode !== 'dark') {
      mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    if (mode === 'dark') root.setAttribute('data-mode', 'dark')
  } catch (e) {
    /* 저장소 접근 불가 — 기본(라이트)로 표시 */
  }
})()
