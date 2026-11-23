import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { api, ApiError, type User } from './lib/api'
import CalendarPage from './pages/CalendarPage'
import LoginPage from './pages/LoginPage'
import StatsPage from './pages/StatsPage'
import TasksPage from './pages/TasksPage'
import TimeBlocksPage from './pages/TimeBlocksPage'

export default function App() {
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

  if (loadError)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center text-sm text-stone-600">
        서버에 연결할 수 없습니다: {loadError}
      </div>
    )
  if (user === undefined) return <div className="grid min-h-dvh place-items-center text-sm text-stone-400">불러오는 중…</div>
  if (user === null) return <LoginPage />

  return (
    <Routes>
      <Route element={<Layout user={user} onLogout={() => setUser(null)} />}>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/blocks" element={<TimeBlocksPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="*" element={<Navigate to="/calendar" replace />} />
      </Route>
    </Routes>
  )
}
