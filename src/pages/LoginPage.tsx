import { Link } from 'react-router'
import { SITE } from '../lib/site'

const ERRORS: Record<string, string> = {
  cancelled: '로그인이 취소되었습니다.',
  not_allowed: '이 구글 계정은 접근이 허용되지 않았습니다.',
  unverified: '이메일 인증이 완료된 구글 계정만 사용할 수 있습니다.',
  state: '로그인 요청이 만료되었습니다. 다시 시도해 주세요.',
  token: '구글 인증에 실패했습니다. 다시 시도해 주세요.',
}

export default function LoginPage() {
  const code = new URLSearchParams(location.search).get('login_error')
  const message = code ? (ERRORS[code] ?? '로그인에 실패했습니다.') : null

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card w-full max-w-sm animate-pop-in p-8 text-center shadow-raised">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-card bg-brand-soft">
          <img src="/favicon.svg" alt="" className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{SITE.name}</h1>
        <p className="mt-2 text-sm text-ink-muted">하루를 계획하고, 꾸준함을 쌓아가세요</p>

        <ul className="mt-6 grid grid-cols-2 gap-2 text-left text-xs font-medium text-ink-muted" aria-label="주요 기능">
          {[
            ['📆', '캘린더'],
            ['✅', '할 일'],
            ['⏱', '타임 블록'],
            ['📊', '통계'],
          ].map(([icon, label]) => (
            <li key={label} className="flex items-center gap-2 rounded-control bg-surface-muted px-3 py-2.5">
              <span aria-hidden="true">{icon}</span>
              {label}
            </li>
          ))}
        </ul>

        {message && <p className="alert-error mt-6">{message}</p>}

        <a
          href="/api/auth/login"
          className="btn-secondary mt-6 w-full gap-3 py-3 text-[15px] shadow-card"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          Google로 로그인
        </a>
        <p className="mt-5 text-xs leading-relaxed text-ink-muted">
          로그인하면{' '}
          <Link to="/terms" className="underline hover:text-ink">
            이용약관
          </Link>
          과{' '}
          <Link to="/privacy" className="underline hover:text-ink">
            개인정보처리방침
          </Link>
          에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  )
}
