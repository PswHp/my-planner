import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { api, type User } from '../lib/api'
import { CalendarIcon, ChartIcon, CheckIcon, ClockIcon } from './Icons'

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/calendar', label: '캘린더', icon: <CalendarIcon /> },
  { to: '/tasks', label: '할 일', icon: <CheckIcon /> },
  { to: '/blocks', label: '타임 블록', icon: <ClockIcon /> },
  { to: '/stats', label: '통계', icon: <ChartIcon /> },
]

export function Layout({ user, onLogout }: { user: User; onLogout: () => void }) {
  const logout = async () => {
    await api.post('/auth/logout', {}).catch(() => {})
    onLogout()
  }

  return (
    <div className="flex min-h-dvh">
      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-stone-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2 text-lg font-bold tracking-tight">플래너</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-c-blue/10 text-[#1c5cab]' : 'text-stone-600 hover:bg-stone-100'
                }`
              }
            >
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t border-stone-100 pt-4">
          {user.picture ? (
            <img src={user.picture} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-stone-200" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name ?? user.email}</div>
            <button onClick={logout} className="cursor-pointer text-xs text-stone-500 hover:underline">
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* 모바일 하단 탭 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-[#1c5cab]' : 'text-stone-500'}`
            }
          >
            {n.icon}
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
