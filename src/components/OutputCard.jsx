import { useState } from 'react'

function parseOutputCard(content) {
  const match = content.match(/<output-card>([\s\S]*?)<\/output-card>/)
  if (!match) return null
  return match[1].trim()
}

function renderMarkdown(text) {
  // Simple markdown: bold, bullets
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, (match) => `<ul>${match}</ul>`)
}

export default function OutputCard({ content }) {
  const [copied, setCopied] = useState(false)
  const cardContent = parseOutputCard(content)

  if (!cardContent) return null

  const handleCopy = () => {
    const plainText = cardContent
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/<[^>]+>/g, '')
      .trim()
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Extract the text after the output card tag for the follow-up message
  const followUp = content.replace(/<output-card>[\s\S]*?<\/output-card>/, '').trim()

  return (
    <div className="output-card-wrapper">
      <div className="output-card">
        <div className="output-card-header">
          <div className="output-card-badge">Phase 1 Output</div>
          <button
            className={`copy-button ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div
          className="output-card-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(cardContent) }}
        />
      </div>
      {followUp && (
        <div className="message assistant follow-up">
          {followUp}
        </div>
      )}
    </div>
  )
}

export { parseOutputCard }
