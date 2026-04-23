import { useState, useEffect } from 'react'
import PhaseSidebar from './components/PhaseSidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ChatInput from './components/ChatInput.jsx'
import DocPanel from './components/DocPanel.jsx'
import { useConversation } from './hooks/useConversation.js'
import './styles/main.css'

const PREFS_KEY = 'discovery-prefs'

function loadPrefs() {
  try { return { theme: 'dark', collapsed: false, showDocPanel: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } }
  catch { return { theme: 'dark', collapsed: false, showDocPanel: true } }
}

export default function App() {
  const { messages, isLoading, error, docSections, sendUserMessage } = useConversation()
  const [prefs, setPrefs] = useState(loadPrefs)

  const updatePrefs = (patch) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      return next
    })
  }

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme)
  }, [prefs.theme])

  return (
    <div className={`app-shell${prefs.collapsed ? ' sidebar-collapsed' : ''}${!prefs.showDocPanel ? ' no-doc' : ''}`}>

      <PhaseSidebar
        currentPhase={1}
        collapsed={prefs.collapsed}
        onToggleCollapse={() => updatePrefs({ collapsed: !prefs.collapsed })}
        theme={prefs.theme}
        onThemeChange={t => updatePrefs({ theme: t })}
        showDocPanel={prefs.showDocPanel}
        onToggleDocPanel={() => updatePrefs({ showDocPanel: !prefs.showDocPanel })}
      />

      <div className="chat-col">
        <main className="main">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            error={error}
          />
        </main>
        <footer className="footer">
          <ChatInput onSend={sendUserMessage} isLoading={isLoading} />
        </footer>
      </div>

      {prefs.showDocPanel && (
        <DocPanel sections={docSections} isLoading={isLoading} />
      )}

    </div>
  )
}
