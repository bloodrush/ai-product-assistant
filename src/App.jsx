import { useState, useEffect, useCallback, useRef } from 'react'
import PhaseSidebar from './components/PhaseSidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ChatInput from './components/ChatInput.jsx'
import DocPanel from './components/DocPanel.jsx'
import PasswordGate from './components/PasswordGate.jsx'
import { useConversation } from './hooks/useConversation.js'
import { loadDiscovery, saveDiscovery, clearDiscovery } from './lib/persistence.js'
import { SAMPLE_OUTPUTS } from './lib/sampleOutputs.js'
import './styles/main.css'

const isDev = import.meta.env.DEV

const PREFS_KEY = 'discovery-prefs'

function formatCarryIn(phase, output) {
  if (phase === 1 && !output.rawText) {
    return [
      'Here is the Phase 1 output:',
      output.problem    && `**Problem**\n${output.problem}`,
      output.affected   && `**Who is affected**\n${output.affected}`,
      output.mustHaves  && `**Must-haves**\n${output.mustHaves}`,
      output.noGoes     && `**No-goes**\n${output.noGoes}`,
      output.whatGood   && `**What good looks like**\n${output.whatGood}`,
    ].filter(Boolean).join('\n\n')
  }
  return `Here is the Phase ${phase} output:\n\n${output.rawText}`
}

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

  const pendingCarryInRef = useRef(null)

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

  const { messages, isLoading, error, docSections, phaseOutputReceived, sendUserMessage, injectPhaseOutput, reset } = useConversation(activePhase, {
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

  const handleAdvancePhase = useCallback(() => {
    const output = phaseOutputsRef.current[activePhase]
    if (output && Object.keys(output).some(k => output[k])) {
      pendingCarryInRef.current = formatCarryIn(activePhase, output)
    }
    setActivePhase(prev => prev + 1)
  }, [activePhase])

  const handleInjectSampleOutput = useCallback(() => {
    const sample = SAMPLE_OUTPUTS[activePhase]
    injectPhaseOutput(sample)
    if (activePhase > 1) {
      phaseOutputsRef.current = { ...phaseOutputsRef.current, [activePhase]: { rawText: sample } }
    }
  }, [activePhase, injectPhaseOutput])

  useEffect(() => {
    if (pendingCarryInRef.current === null) return
    if (messages.length !== 0 || isLoading) return
    const msg = pendingCarryInRef.current
    pendingCarryInRef.current = null
    sendUserMessage(msg)
  }, [messages, isLoading, sendUserMessage])

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
            phase={activePhase}
            showAdvanceButton={phaseOutputReceived && activePhase < 5}
            onAdvancePhase={handleAdvancePhase}
            onInjectSampleOutput={isDev && !phaseOutputReceived ? handleInjectSampleOutput : undefined}
          />
        </main>
        <footer className="footer">
          <ChatInput onSend={sendUserMessage} isLoading={isLoading} phaseComplete={phaseOutputReceived && activePhase < 5} />
        </footer>
      </div>

      {prefs.showDocPanel && (
        <DocPanel sections={docSections} isLoading={isLoading} />
      )}

    </div>
  )
}
