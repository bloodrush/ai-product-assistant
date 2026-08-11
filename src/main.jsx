import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import InterviewApp from './pages/InterviewApp.jsx'

const isInterview = window.location.pathname === '/interview'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isInterview ? <InterviewApp /> : <App />}
  </StrictMode>
)
