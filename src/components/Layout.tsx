import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { api, type User } from '../lib/api'
import { SITE } from '../lib/site'
import {
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  ChevronRight,
  ClockIcon,
  DocIcon,
  GearIcon,
  GridIcon,
  LogoutIcon,
  UserIcon,
} from './Icons'

/**
 * 내비게이션 메뉴 정의 — 메뉴를 추가/변경할 때는 이 배열만 수정하면
 * PC 사이드바, 태블릿 아이콘 바, 모바일 하단 탭에 모두 반영됩니다.
 */
interface NavItem {
  to: string
  label: string
  icon: ReactNode
}
const NAV: NavItem[] = [
  { to: '/calendar', label: '캘린더', icon: <CalendarIcon /> },
  { to: '/tasks', label: '할 일', icon: <CheckIcon /> },
  { to: '/blocks', label: '타임 블록', icon: <ClockIcon /> },
  { to: '/stats', label: '통계', icon: <ChartIcon /> },
]

export function Layout({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // 페이지가 바뀌면 모바일 전체 메뉴 닫기
  useEffect(() => setMenuOpen(false), [pathname])

  const logout = async () => {
    await api.post('/auth/logout', {}).catch(() => {})
    onLogout()
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar user={user} />

      <main className="min-w-0 flex-1 px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8 md:pt-8 md:pb-10">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>

      <MobileTabBar onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
      {menuOpen && <MobileMenu user={user} onClose={() => setMenuOpen(false)} onLogout={logout} />}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   PC · 태블릿 사이드바
   - md(768px)~lg(1024px): 아이콘만 보이는 축소형 (72px)
   - lg 이상: 아이콘 + 텍스트 (240px)
--------------------------------------------------------------------------- */
function Sidebar({ user }: { user: User }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex lg:w-60 lg:px-4">
      {/* 상단: 로고 + 이름 */}
      <Link
        to="/"
        className="mb-7 flex h-10 items-center gap-2.5 rounded-control px-1.5 transition hover:bg-surface-hover lg:px-2"
        aria-label={`${SITE.name} 홈`}
      >
        <img src="/favicon.svg" alt="" className="h-8 w-8 shrink-0" />
        <span className="hidden text-[17px] font-bold tracking-tight lg:inline">{SITE.name}</span>
      </Link>

      {/* 중앙: 메뉴 */}
      <nav className="flex flex-col gap-1" aria-label="주 메뉴">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            title={n.label}
            className={({ isActive }) =>
              `group flex h-11 items-center justify-center gap-3 rounded-control text-sm font-medium transition duration-150 lg:justify-start lg:px-3 ${
                isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`shrink-0 transition ${isActive ? 'text-brand' : 'group-hover:scale-105'}`}>{n.icon}</span>
                <span className="hidden lg:inline">{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 하단: 프로필 */}
      <NavLink
        to="/settings"
        title="프로필 · 설정"
        className={({ isActive }) =>
          `mt-auto flex items-center justify-center gap-3 rounded-control p-1.5 transition duration-150 lg:justify-start lg:p-2 ${
            isActive ? 'bg-brand-soft' : 'hover:bg-surface-hover'
          }`
        }
      >
        <Avatar user={user} size={36} />
        <span className="hidden min-w-0 flex-1 lg:block">
          <span className="block truncate text-sm font-semibold">{displayName(user)}</span>
          <span className="block text-xs text-ink-subtle">프로필 · 설정</span>
        </span>
      </NavLink>
    </aside>
  )
}

/* ---------------------------------------------------------------------------
   모바일 하단 탭 — 주요 기능 4개 + 전체 메뉴
--------------------------------------------------------------------------- */
function MobileTabBar({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const itemClass = (active: boolean) =>
    `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition duration-150 ${
      active ? 'text-brand-ink' : 'text-ink-subtle'
    }`
  const iconClass = (active: boolean) =>
    `grid h-7 w-12 place-items-center rounded-full transition duration-150 ${active ? 'bg-brand-soft text-brand' : ''}`

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="주 메뉴"
    >
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => (
            <>
              <span className={iconClass(isActive)}>{n.icon}</span>
              {n.label}
            </>
          )}
        </NavLink>
      ))}
      <button type="button" onClick={onOpenMenu} className={itemClass(menuOpen)} aria-haspopup="dialog" aria-expanded={menuOpen}>
        <span className={iconClass(menuOpen)}>
          <GridIcon />
        </span>
        전체
      </button>
    </nav>
  )
}

/* ---------------------------------------------------------------------------
   모바일 전체 메뉴 (바텀시트) — 하단 탭에 없는 기능 모음
--------------------------------------------------------------------------- */
function MobileMenu({ user, onClose, onLogout }: { user: User; onClose: () => void; onLogout: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sheetRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rowBase = 'flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-sm font-medium transition'
  const row = `${rowBase} text-ink hover:bg-surface-hover`

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end bg-ink/30 md:hidden"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="전체 메뉴"
        className="w-full animate-sheet-in rounded-t-sheet bg-surface px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-pop"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />

        <Link to="/settings" className="mb-2 flex items-center gap-3 rounded-card bg-surface-muted p-3 transition hover:bg-surface-hover">
          <Avatar user={user} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{displayName(user)}</span>
            <span className="block truncate text-xs text-ink-subtle">{user.email}</span>
          </span>
          <ChevronRight />
        </Link>

        <div className="space-y-0.5">
          <Link to="/settings" className={row}>
            <span className="text-ink-muted">
              <GearIcon />
            </span>
            프로필 · 설정
          </Link>
          <Link to="/privacy" className={row}>
            <span className="text-ink-muted">
              <DocIcon />
            </span>
            개인정보처리방침
          </Link>
          <Link to="/terms" className={row}>
            <span className="text-ink-muted">
              <DocIcon />
            </span>
            이용약관
          </Link>
          <button type="button" onClick={onLogout} className={`${rowBase} cursor-pointer text-danger hover:bg-danger-soft`}>
            <LogoutIcon />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   공통 조각
--------------------------------------------------------------------------- */
const displayName = (user: User) => user.name || user.email.split('@')[0]

/** 프로필 이미지 (없으면 기본 아이콘) — 향후 캐릭터/꾸미기 아바타로 교체하기 쉬운 단일 컴포넌트 */
export function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (user.picture && !broken)
    return (
      <img
        src={user.picture}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover ring-2 ring-surface"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-brand-soft text-brand"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <UserIcon />
    </span>
  )
}

/** 페이지 상단 제목 영역 */
export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
