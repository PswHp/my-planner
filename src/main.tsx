import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import './index.css'
import { applyTheme, getTheme } from './lib/theme'

// 저장된 테마를 첫 화면 그리기 전에 적용
applyTheme(getTheme(), false)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
