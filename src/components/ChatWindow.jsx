import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'

export default function ChatWindow({ messages, isLoading, error }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="chat-window">
      {messages.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-label">Phase 1 — Understand the Problem</p>
          <p className="empty-state-hint">
            Paste your context below — a Slack message, stakeholder email, rough brief, or a few bullet points. The AI takes it from there.
          </p>
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

      <div ref={bottomRef} />
    </div>
  )
}
