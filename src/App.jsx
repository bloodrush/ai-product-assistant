import { useState, useEffect, useCallback, useRef } from 'react'
import PhaseSidebar from './components/PhaseSidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ChatInput from './components/ChatInput.jsx'
import DocPanel from './components/DocPanel.jsx'
import PasswordGate from './components/PasswordGate.jsx'
import { useConversation } from './hooks/useConversation.js'
import {
  migrateLegacyDiscovery,
  getAllDiscoveries,
  createDiscovery,
  setActiveDiscovery,
  loadActiveDiscovery,
  saveDiscovery,
  deriveDiscoveryName,
} from './lib/persistence.js'
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
  try { return { theme: 'dark', collapsed: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } }
  catch { return { theme: 'dark', collapsed: false } }
}

export default function App() {
  const [initialLoad] = useState(() => {
    migrateLegacyDiscovery()
    return loadActiveDiscovery() ?? { item: createDiscovery(), conversation: [] }
  })

  const [activePhase, setActivePhase] = useState(initialLoad.item.currentPhase)
  const [activeDiscoveryId, setActiveDiscoveryId] = useState(initialLoad.item.id)
  const [discoveries, setDiscoveries] = useState(() => getAllDiscoveries())
  const createdAtRef = useRef(initialLoad.item.createdAt)
  const phaseOutputsRef = useRef(initialLoad.item.phaseOutputs)
  const [phaseOutputs, setPhaseOutputs] = useState(initialLoad.item.phaseOutputs)

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

  const { messages, isLoading, error, docSections, phaseOutputReceived, sendUserMessage, injectPhaseOutput, reset, reinitialize } = useConversation(activePhase, {
    onUnauthorized: handleUnauthorized,
    initialMessages: initialLoad.conversation,
    initialDocSections: initialLoad.item.phaseOutputs[initialLoad.item.currentPhase] ?? {},
  })

  useEffect(() => {
    if (isLoading || messages.length === 0) return
    if (!createdAtRef.current) createdAtRef.current = new Date().toISOString()
    if (Object.keys(docSections).length > 0) {
      const updated = { ...phaseOutputsRef.current, [activePhase]: docSections }
      phaseOutputsRef.current = updated
      setPhaseOutputs(updated)
    }

    const problemText = phaseOutputsRef.current[1]?.problem
    const currentItem = discoveries.find(d => d.id === activeDiscoveryId)
    const derivedName = (problemText && currentItem?.nameSource === 'date')
      ? deriveDiscoveryName(problemText) : undefined

    saveDiscovery(activeDiscoveryId, {
      currentPhase: activePhase,
      conversation: messages,
      phaseOutputs: phaseOutputsRef.current,
      name: derivedName,
    })
    if (derivedName) setDiscoveries(getAllDiscoveries())
  }, [messages, isLoading, docSections, activePhase, activeDiscoveryId])

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
      const updated = { ...phaseOutputsRef.current, [activePhase]: { rawText: sample } }
      phaseOutputsRef.current = updated
      setPhaseOutputs(updated)
    }
  }, [activePhase, injectPhaseOutput])

  useEffect(() => {
    if (pendingCarryInRef.current === null) return
    if (messages.length !== 0 || isLoading) return
    const msg = pendingCarryInRef.current
    pendingCarryInRef.current = null
    sendUserMessage(msg)
  }, [messages, isLoading, sendUserMessage])

  const handleSwitchDiscovery = useCallback((id) => {
    if (id === activeDiscoveryId) return
    setActiveDiscovery(id)
    const loaded = loadActiveDiscovery()
    if (!loaded) return
    createdAtRef.current    = loaded.item.createdAt
    phaseOutputsRef.current = loaded.item.phaseOutputs
    reinitialize(
      loaded.conversation,
      loaded.item.phaseOutputs[loaded.item.currentPhase] ?? {}
    )
    setPhaseOutputs(loaded.item.phaseOutputs)
    setActivePhase(loaded.item.currentPhase)
    setActiveDiscoveryId(id)
    setDiscoveries(getAllDiscoveries())
  }, [activeDiscoveryId, reinitialize])

  const handleStartNew = useCallback(() => {
    const newDisc = createDiscovery()
    createdAtRef.current    = newDisc.createdAt
    phaseOutputsRef.current = {}
    setPhaseOutputs({})
    reset()
    setActivePhase(1)
    setActiveDiscoveryId(newDisc.id)
    setDiscoveries(getAllDiscoveries())
  }, [reset])

  const [prefs, setPrefs] = useState(loadPrefs)

  const updatePrefs = (patch) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme)
  }, [prefs.theme])

  if (!authenticated) {
    return <PasswordGate onSuccess={handleAuthSuccess} error={authError} />
  }

  return (
    <div className={`app-shell${prefs.collapsed ? ' sidebar-collapsed' : ''}`}>

      <PhaseSidebar
        collapsed={prefs.collapsed}
        onToggleCollapse={() => updatePrefs({ collapsed: !prefs.collapsed })}
        theme={prefs.theme}
        onThemeChange={t => updatePrefs({ theme: t })}
        discoveries={discoveries}
        activeDiscoveryId={activeDiscoveryId}
        onSwitchDiscovery={handleSwitchDiscovery}
        onStartNew={handleStartNew}
      />

      <div className="chat-col">
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

      <DocPanel
        sections={docSections}
        isLoading={isLoading}
        currentPhase={activePhase}
        phaseOutputs={phaseOutputs}
      />

    </div>
  )
}
