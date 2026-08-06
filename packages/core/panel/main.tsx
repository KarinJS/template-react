import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/main.css'

// 生产和插件开发模板会挂在 /__ktr/panel，core 面板本地开发时则可以直接跑在根路径。
const panelBasename = window.location.pathname.startsWith('/__ktr/panel') ? '/__ktr/panel' : undefined

// StrictMode 用于提前暴露副作用问题；BrowserRouter 让模板路由可分享、可刷新。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter {...(panelBasename ? { basename: panelBasename } : {})}>
      <App />
    </BrowserRouter>
  </StrictMode>
)
