import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar, PageHeader } from '../components/Layout'
import { api, type User } from '../lib/api'
import { applyTheme, getTheme, THEMES, type ThemeId } from '../lib/theme'

export default function SettingsPage({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const logout = async () => {
    await api.post('/auth/logout', {}).catch(() => {})
    onSignedOut()
  }

  const deleteAccount = async () => {
    setDeleting(true)
    setError(null)
    try {
      await api.del('/me', { confirm })
      onSignedOut()
    } catch (e) {
      setError((e as Error).message)
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="프로필 · 설정" description="계정 정보와 내 데이터를 관리합니다" />

      {/* 프로필 — 향후 캐릭터/꾸미기 영역을 이 카드에 확장 */}
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar user={user} size={56} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold">{user.name ?? '이름 없음'}</div>
          <div className="truncate text-sm text-ink-muted">{user.email}</div>
        </div>
        <button className="btn-secondary" onClick={logout}>
          로그아웃
        </button>
      </section>

      <ThemePicker />

      <section className="card p-5">
        <h2 className="section-title">내 데이터 내보내기</h2>
        <p className="mt-1 text-sm text-ink-muted">
          계정 정보, 일정, 할 일, 타임 블록, 코인 · 액세서리 · 일일 보상 기록까지 내 데이터 전체를 JSON 파일로 내려받습니다.
        </p>
        <a href="/api/export" download className="btn-secondary mt-4">
          내려받기
        </a>
      </section>

      <section className="card border-danger-line p-5">
        <h2 className="section-title text-danger">회원 탈퇴</h2>
        <p className="mt-1 text-sm text-ink-muted">
          계정과 모든 일정·할 일·타임 블록이 <strong className="text-ink">즉시 영구 삭제</strong>되며 복구할 수 없습니다. 계속하려면 이메일
          주소(<span className="font-mono text-ink">{user.email}</span>)를 입력하세요.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="input min-w-0 flex-1 sm:max-w-xs"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={user.email}
            aria-label="확인용 이메일"
            autoComplete="off"
          />
          <button className="btn-danger-solid" disabled={confirm !== user.email || deleting} onClick={deleteAccount}>
            {deleting ? '삭제 중…' : '탈퇴하고 모든 데이터 삭제'}
          </button>
        </div>
        {error && <p className="alert-error mt-3">{error}</p>}
      </section>

      <p className="text-center text-xs text-ink-muted">
        <Link to="/privacy" className="hover:text-ink hover:underline">
          개인정보처리방침
        </Link>
        {' · '}
        <Link to="/terms" className="hover:text-ink hover:underline">
          이용약관
        </Link>
      </p>
    </div>
  )
}

/** 테마 색 선택 — 이 기기에만 저장 */
function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>(getTheme)
  const choose = (id: ThemeId) => {
    setTheme(id)
    applyTheme(id)
  }
  return (
    <section className="card p-5">
      <h2 className="section-title">테마 색</h2>
      <p className="mt-1 mb-4 text-sm text-ink-muted">사이트 전체의 포인트 색을 바꿔요. 선택한 테마는 이 기기에만 저장돼요.</p>
      <div role="radiogroup" aria-label="테마 색" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEMES.map((t) => {
          const on = t.id === theme
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(t.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 text-left transition active:scale-[0.98] sm:flex-col sm:gap-2 sm:text-center ${
                on ? 'border-brand bg-brand-soft ring-2 ring-brand/25' : 'border-line bg-field hover:border-line-strong'
              }`}
            >
              <span
                className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-black/5"
                style={{ background: `conic-gradient(${t.swatch[0]} 0 50%, ${t.swatch[2]} 0 75%, ${t.swatch[1]} 0)` }}
                aria-hidden="true"
              >
                {on && (
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full bg-white/90 text-[11px] font-bold"
                    style={{ color: t.swatch[2] }}
                  >
                    ✓
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${on ? 'text-brand-ink' : ''}`}>{t.label}</span>
                <span className="block text-xs text-ink-subtle">{t.desc}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
