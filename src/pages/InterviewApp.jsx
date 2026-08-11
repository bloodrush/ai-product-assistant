import { useState, useCallback, useRef, useEffect } from 'react'
import ChatWindow from '../components/ChatWindow.jsx'
import ChatInput from '../components/ChatInput.jsx'
import PasswordGate from '../components/PasswordGate.jsx'
import { useConversation } from '../hooks/useConversation.js'
import { AI_DISCOVERY_OPENER } from '../lib/prompts/aiDiscovery.js'
import { AI_DISCOVERY_SAMPLE } from '../lib/sampleOutputs.js'
import '../styles/main.css'

const isDev = import.meta.env.DEV

const AI_OPENER_MSG = { role: 'assistant', content: AI_DISCOVERY_OPENER, _displayOnly: true }

export default function InterviewApp() {
  const [authenticated, setAuthenticated] = useState(() => !!sessionStorage.getItem('sharedPassword'))
  const [authError, setAuthError] = useState(null)
  const [done, setDone] = useState(false)
  const [exportState, setExportState] = useState(null) // null | 'saving' | { error }

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem('sharedPassword')
    setAuthError('Incorrect password. Try again.')
    setAuthenticated(false)
  }, [])

  const { messages, isLoading, error, docSections, phaseOutputReceived, sendUserMessage, injectPhaseOutput } = useConversation(1, {
    onUnauthorized: handleUnauthorized,
    initialMessages: [AI_OPENER_MSG],
    initialDocSections: {},
    mode: 'ai-discovery',
  })

  const savedRef = useRef(false)
  const messagesRef = useRef(messages)
  const docSectionsRef = useRef(docSections)
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { docSectionsRef.current = docSections }, [docSections])

  const doSave = useCallback(() => {
    const { name, team, date, topics } = docSectionsRef.current
    if (!topics?.length) return
    savedRef.current = true
    if (isDev) { setDone(true); return }
    setExportState('saving')

    fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-password': sessionStorage.getItem('sharedPassword') ?? '',
      },
      body: JSON.stringify({
        session: { name, team, date },
        messages: messagesRef.current.filter(m => !m._displayOnly),
      }),
    })
      .then(async r => {
        let d = {}
        try { d = await r.json() } catch {}
        return { ok: r.ok, d }
      })
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? 'Export failed — run vercel dev to test the full save path')
        setDone(true)
      })
      .catch(err => {
        savedRef.current = false
        setExportState({ error: err.message })
      })
  }, [])

  useEffect(() => {
    if (!phaseOutputReceived || savedRef.current) return
    doSave()
  }, [phaseOutputReceived, doSave])

  if (!authenticated) {
    return (
      <PasswordGate
        onSuccess={() => { setAuthError(null); setAuthenticated(true) }}
        error={authError}
      />
    )
  }

  if (done) {
    return (
      <div className="interview-done">
        <div className="interview-done-inner">
          <div className="interview-done-check">✓</div>
          <h1 className="interview-done-heading">Thanks, you're done.</h1>
          <p className="interview-done-sub">Your responses have been saved. You can close this window.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="interview-shell">
      <main className="interview-main">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          error={error}
          phase={1}
          mode="ai-discovery"
          showAdvanceButton={false}
          onInjectSampleOutput={isDev && !phaseOutputReceived ? () => injectPhaseOutput(AI_DISCOVERY_SAMPLE) : undefined}
        />
      </main>

      {exportState && (
        <div className={`interview-status-bar${exportState?.error ? ' error' : ''}`}>
          {exportState === 'saving' && 'Saving your responses…'}
          {exportState?.error && (
            <>{`Save failed — ${exportState.error} · `}
              <button className="interview-retry-btn" onClick={doSave}>Retry</button>
            </>
          )}
        </div>
      )}

      <footer className="footer">
        <ChatInput onSend={sendUserMessage} isLoading={isLoading} phaseComplete={false} />
      </footer>
    </div>
  )
}
