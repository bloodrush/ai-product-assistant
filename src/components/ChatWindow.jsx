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
            Paste your rough idea, Slack message, stakeholder email, or bullet points below. I'll take it from there — guiding you through structured problem discovery until we have a clear, well-defined problem statement.
          </p>
          <p className="empty-state-tip">
            Tip: The more raw context you paste, the better I can reflect it back.
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
