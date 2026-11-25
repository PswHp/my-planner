import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { Layout } from './components/Layout'
import { DailyReward } from './components/DailyReward'
import { api, ApiError, type Me } from './lib/api'
import CalendarPage from './pages/CalendarPage'
import DashboardPage from './pages/DashboardPage'
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
  const [user, setUser] = useState<Me | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rewardHidden, setRewardHidden] = useState(false)

  const loadUser = useCallback(() => {
    api
      .get<Me>('/me')
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
      <div className="grid min-h-dvh place-items-center p-6 text-center text-sm text-ink-muted">서버에 연결할 수 없습니다: {loadError}</div>
    )
  if (user === undefined) return <div className="grid min-h-dvh place-items-center text-sm text-ink-subtle">불러오는 중…</div>
  if (user === null) return <LoginPage />

  const signedOut = () => {
    setUser(null)
    history.replaceState(null, '', '/')
  }

  // 오늘 첫 접속 보상 — '나중에 받기'를 누르면 이번 방문(탭)에서는 다시 띄우지 않음
  const laterKey = `dailumi:reward-later:${user.dailyReward.date}`
  let later = false
  try {
    later = sessionStorage.getItem(laterKey) === '1'
  } catch {
    /* 저장소 사용 불가 */
  }
  const showReward = !user.dailyReward.claimed && !later && !rewardHidden

  return (
    <>
      <Routes>
        <Route element={<Layout user={user} onLogout={signedOut} />}>
          <Route path="/dashboard" element={<DashboardPage user={user} guideReady={!showReward} />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/blocks" element={<TimeBlocksPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage user={user} onSignedOut={signedOut} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
      {showReward && (
        <DailyReward
          onDone={(r) => setUser({ ...user, coins: r.totalCoins, dailyReward: { ...user.dailyReward, claimed: true } })}
          onLater={() => {
            try {
              sessionStorage.setItem(laterKey, '1')
            } catch {
              /* 저장소 사용 불가 — 이번 화면에서만 닫기 */
            }
            setRewardHidden(true)
          }}
        />
      )}
    </>
  )
}
