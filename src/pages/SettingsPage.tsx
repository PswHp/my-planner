import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../components/Layout'
import { api, type User } from '../lib/api'

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
      <PageHeader title="설정" />

      <section className="card flex items-center gap-4 p-5">
        {user.picture ? (
          <img src={user.picture} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-stone-200" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{user.name ?? '이름 없음'}</div>
          <div className="truncate text-sm text-stone-500">{user.email}</div>
        </div>
        <button className="btn-ghost" onClick={logout}>
          로그아웃
        </button>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">내 데이터 내보내기</h2>
        <p className="mt-1 text-sm text-stone-500">일정, 할 일, 타임 블록 전체를 JSON 파일로 내려받습니다.</p>
        <a href="/api/export" download className="btn-ghost mt-3 border border-stone-200">
          내려받기
        </a>
      </section>

      <section className="card border-red-200 p-5">
        <h2 className="font-semibold text-[#b42f2f]">회원 탈퇴</h2>
        <p className="mt-1 text-sm text-stone-600">
          계정과 모든 일정·할 일·타임 블록이 <strong>즉시 영구 삭제</strong>되며 복구할 수 없습니다. 계속하려면 이메일 주소(
          <span className="font-mono">{user.email}</span>)를 입력하세요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="input max-w-xs flex-1"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={user.email}
            aria-label="확인용 이메일"
            autoComplete="off"
          />
          <button
            className="btn-primary btn-destructive"
            disabled={confirm !== user.email || deleting}
            onClick={deleteAccount}
          >
            {deleting ? '삭제 중…' : '탈퇴하고 모든 데이터 삭제'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-[#b42f2f]">{error}</p>}
      </section>

      <p className="text-center text-xs text-stone-500">
        <Link to="/privacy" className="hover:underline">
          개인정보처리방침
        </Link>
        {' · '}
        <Link to="/terms" className="hover:underline">
          이용약관
        </Link>
      </p>
    </div>
  )
}
