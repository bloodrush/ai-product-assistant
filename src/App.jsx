import { useState, useEffect, useCallback, useRef } from 'react'
import PhaseSidebar from './components/PhaseSidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ChatInput from './components/ChatInput.jsx'
import DocPanel from './components/DocPanel.jsx'
import PasswordGate from './components/PasswordGate.jsx'
import { useConversation } from './hooks/useConversation.js'
import { loadDiscovery, saveDiscovery, clearDiscovery } from './lib/persistence.js'
import './styles/main.css'

const PREFS_KEY = 'discovery-prefs'

function loadPrefs() {
  try { return { theme: 'dark', collapsed: false, showDocPanel: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } }
  catch { return { theme: 'dark', collapsed: false, showDocPanel: true } }
}

function formatRestoreDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function App() {
  const [savedDiscovery] = useState(() => loadDiscovery())
  const [activePhase, setActivePhase] = useState(savedDiscovery?.currentPhase ?? 1)
  const createdAtRef = useRef(savedDiscovery?.createdAt ?? null)
  const phaseOutputsRef = useRef(savedDiscovery?.phaseOutputs ?? {})

  const [authenticated, setAuthenticated] = useState(() => !!sessionStorage.getItem('sharedPassword'))
  const [authError, setAuthError] = useState(null)

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem('sharedPassword')
    setAuthError('Incorrect password. Try again.')
    setAuthenticated(false)
  }, [])

  const handleAuthSuccess = useCallback(() => {
    setAuthError(null)
    setAuthenticated(true)
  }, [])

  const { messages, isLoading, error, docSections, sendUserMessage, reset } = useConversation(activePhase, {
    onUnauthorized: handleUnauthorized,
    initialMessages: savedDiscovery?.conversation ?? [],
    initialDocSections: savedDiscovery?.phaseOutputs?.[savedDiscovery?.currentPhase] ?? {},
  })

  const [showRestoreIndicator, setShowRestoreIndicator] = useState(
    () => !!(savedDiscovery?.conversation?.length > 0)
  )

  useEffect(() => {
    if (isLoading) return
    if (messages.length === 0) return
    if (!createdAtRef.current) createdAtRef.current = new Date().toISOString()
    if (Object.keys(docSections).length > 0) {
      phaseOutputsRef.current = { ...phaseOutputsRef.current, [activePhase]: docSections }
    }
    saveDiscovery({
      version: 1,
      createdAt: createdAtRef.current,
      updatedAt: new Date().toISOString(),
      currentPhase: activePhase,
      conversation: messages,
      phaseOutputs: phaseOutputsRef.current,
    })
  }, [messages, isLoading, docSections, activePhase])

  const handleStartNew = useCallback(() => {
    if (!window.confirm('This will clear your current discovery. Continue?')) return
    clearDiscovery()
    createdAtRef.current = null
    phaseOutputsRef.current = {}
    reset()
    setActivePhase(1)
    setShowRestoreIndicator(false)
  }, [reset])

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

  if (!authenticated) {
    return <PasswordGate onSuccess={handleAuthSuccess} error={authError} />
  }

  return (
    <div className={`app-shell${prefs.collapsed ? ' sidebar-collapsed' : ''}${!prefs.showDocPanel ? ' no-doc' : ''}`}>

      <PhaseSidebar
        currentPhase={activePhase}
        collapsed={prefs.collapsed}
        onToggleCollapse={() => updatePrefs({ collapsed: !prefs.collapsed })}
        theme={prefs.theme}
        onThemeChange={t => updatePrefs({ theme: t })}
        showDocPanel={prefs.showDocPanel}
        onToggleDocPanel={() => updatePrefs({ showDocPanel: !prefs.showDocPanel })}
        onStartNew={handleStartNew}
      />

      <div className="chat-col">
        {showRestoreIndicator && (
          <div className="restore-indicator" onClick={() => setShowRestoreIndicator(false)}>
            Resuming your discovery — Phase {activePhase}, started {formatRestoreDate(savedDiscovery.createdAt)}
          </div>
        )}
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
