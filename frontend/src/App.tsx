import type { ReactElement } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import Footer from './components/Footer'
import NoticeBanner from './components/NoticeBanner'
import { useNotice } from './hooks/useNotice'

function RequireAuth({ children }: { children: ReactElement }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/" replace />
}

function NoticeArea() {
  useLocation() // re-render on route change to pick up token changes
  const token = localStorage.getItem('token')
  const publicUrl = window.__APP_CONFIG__?.noticePublicGistUrl || undefined
  const userUrl = token ? (window.__APP_CONFIG__?.noticeUsersGistUrl || undefined) : undefined
  const userContent = useNotice(userUrl)
  return <NoticeBanner url={userContent ? userUrl : publicUrl} />
}

export default function App() {
  return (
    <BrowserRouter>
      <NoticeArea />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/dashboard"
          element={<RequireAuth><DashboardPage /></RequireAuth>}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
