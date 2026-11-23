import { Link } from 'react-router'
import { CAT, CLOUD, FLOWER, FLOWER_PINK, GRASS, PixelArt, PixelStrip, TREE } from '../components/Pixel'
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
      <div className="card w-full max-w-sm animate-pop-in overflow-hidden p-0 text-center shadow-raised">
        <div className="relative h-36 bg-gradient-to-b from-sky to-sky-end">
          <PixelArt sprite={CLOUD} scale={3} className="absolute top-5 left-8 opacity-90" />
          <PixelArt sprite={CLOUD} scale={2} className="absolute top-10 right-10 opacity-80" />
          <PixelArt sprite={TREE} scale={4} className="absolute bottom-[14px] -left-3" />
          <PixelArt sprite={TREE} scale={3} className="absolute right-0 bottom-[14px]" />
          <PixelArt sprite={FLOWER} scale={2} className="absolute bottom-[16px] left-[30%]" />
          <PixelArt sprite={FLOWER_PINK} scale={2} className="absolute right-[26%] bottom-[16px]" />
          <PixelStrip sprite={GRASS} scale={3} className="absolute inset-x-0 bottom-0" />
          <PixelArt
            sprite={CAT}
            scale={4}
            className="absolute bottom-[10px] left-1/2 -translate-x-[45%] animate-bob"
            label="Dailumi 고양이"
          />
        </div>

        <div className="px-7 pt-6 pb-7">
          <h1 className="text-[32px] leading-none font-extrabold tracking-tight text-brand">{SITE.name}</h1>
          <p className="mt-1.5 text-lg font-bold text-brand-ink">{SITE.nameKo}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-ink">
            <span aria-hidden="true">🐾</span>
            {SITE.tagline}
          </p>

          <ul className="mt-6 grid grid-cols-2 gap-2 text-left text-xs font-medium text-ink-muted" aria-label="주요 기능">
            {[
              ['📆', '일정 관리'],
              ['✅', '할 일 목록'],
              ['⏱', '타임 블록'],
              ['📊', '통계'],
            ].map(([icon, label]) => (
              <li key={label} className="flex items-center gap-2 rounded-control bg-field px-3 py-2.5 ring-1 ring-line">
                <span aria-hidden="true">{icon}</span>
                {label}
              </li>
            ))}
          </ul>

          {message && <p className="alert-error mt-6">{message}</p>}

          <a href="/api/auth/login" className="btn-secondary mt-6 w-full gap-3 py-3 text-[15px] shadow-card">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
              />
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
    </div>
  )
}
