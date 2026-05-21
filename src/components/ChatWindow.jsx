import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'

const PHASE_EMPTY = {
  1: {
    label: 'Phase 1 — Understand the Problem',
    hint: 'Paste your rough idea, Slack message, stakeholder email, or bullet points below. I\'ll take it from there — guiding you through structured problem discovery until we have a clear, well-defined problem statement.',
    tip: 'Tip: The more raw context you paste, the better I can reflect it back.',
  },
  2: {
    label: 'Phase 2 — Validate the Problem',
    hint: 'Phase 2 will begin automatically with your Phase 1 output carried over.',
  },
  3: {
    label: 'Phase 3 — Forge the Solution',
    hint: 'Phase 3 will begin with your previous output carried over.',
  },
  4: {
    label: 'Phase 4 — Write the Stories',
    hint: 'Phase 4 will begin with your previous output carried over.',
  },
  5: {
    label: 'Phase 5 — Launch Prep',
    hint: 'Phase 5 will begin with your previous output carried over.',
  },
}

export default function ChatWindow({ messages, isLoading, error, phase = 1, showAdvanceButton, onAdvancePhase, onInjectSampleOutput }) {
  const bottomRef = useRef(null)
  const empty = PHASE_EMPTY[phase] ?? PHASE_EMPTY[1]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="chat-window">
      {messages.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-label">{empty.label}</p>
          <p className="empty-state-hint">{empty.hint}</p>
          {empty.tip && (
            <p className="empty-state-tip">{empty.tip}</p>
          )}
        </div>
      )}

      {messages.map((msg, i) => (
        <MessageBubble key={i} role={msg.role} content={msg.content} />
      ))}

      {isLoading && (
        <div className="message assistant">
          <div className="typing-indicator">
            <span /><span /><span />
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {onInjectSampleOutput && !isLoading && (
        <div className="phase-advance-cta">
          <button className="dev-inject-btn" onClick={onInjectSampleOutput}>
            ⚡ Inject sample output
          </button>
        </div>
      )}

      {showAdvanceButton && !isLoading && (
        <div className="phase-advance-cta">
          <button className="phase-advance-btn" onClick={onAdvancePhase}>
            Continue to Phase {phase + 1} →
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
