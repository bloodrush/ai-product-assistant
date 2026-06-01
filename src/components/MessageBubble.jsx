import OutputCard, { parseOutputCard } from './OutputCard.jsx'

export default function MessageBubble({ role, content, phase }) {
  if (role === 'assistant' && parseOutputCard(content)) {
    return <OutputCard content={content} phase={phase} />
  }

  return (
    <div className={`message ${role}`}>
      <div className="message-content">
        {content}
      </div>
    </div>
  )
}
