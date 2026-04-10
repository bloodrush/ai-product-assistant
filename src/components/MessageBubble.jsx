import OutputCard, { parseOutputCard } from './OutputCard.jsx'

export default function MessageBubble({ role, content }) {
  if (role === 'assistant' && parseOutputCard(content)) {
    return <OutputCard content={content} />
  }

  return (
    <div className={`message ${role}`}>
      <div className="message-content">
        {content}
      </div>
    </div>
  )
}
