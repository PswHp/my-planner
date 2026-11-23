import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { Layout } from './components/Layout'
import { api, ApiError, type User } from './lib/api'
import CalendarPage from './pages/CalendarPage'
import { PrivacyPage, TermsPage } from './pages/LegalPages'
import LoginPage from './pages/LoginPage'
import SettingsPage from './pages/SettingsPage'
import StatsPage from './pages/StatsPage'
import TasksPage from './pages/TasksPage'
import TimeBlocksPage from './pages/TimeBlocksPage'

const PUBLIC_PATHS: Record<string, () => React.JSX.Element> = {
  '/privacy': PrivacyPage,
  '/terms': TermsPage,
}

export default function App() {
  const { pathname } = useLocation()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadUser = useCallback(() => {
    api
      .get<User>('/me')
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setUser(null)
        else setLoadError(e.message)
      })
  }, [])

  useEffect(() => {
    loadUser()
    const onExpired = () => setUser(null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [loadUser])

  // 개인정보처리방침/약관은 로그인 없이 볼 수 있어야 함
  const PublicPage = PUBLIC_PATHS[pathname]
  if (PublicPage) return <PublicPage />

  if (loadError)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center text-sm text-ink-muted">
        서버에 연결할 수 없습니다: {loadError}
      </div>
    )
  if (user === undefined) return <div className="grid min-h-dvh place-items-center text-sm text-ink-subtle">불러오는 중…</div>
  if (user === null) return <LoginPage />

  const signedOut = () => {
    setUser(null)
    history.replaceState(null, '', '/')
  }

  return (
    <Routes>
      <Route element={<Layout user={user} onLogout={signedOut} />}>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/blocks" element={<TimeBlocksPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage user={user} onSignedOut={signedOut} />} />
        <Route path="*" element={<Navigate to="/calendar" replace />} />
      </Route>
    </Routes>
  )
}
