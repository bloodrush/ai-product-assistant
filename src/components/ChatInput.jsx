import { useState, useRef, useEffect } from 'react'

export default function ChatInput({ onSend, isLoading, phaseComplete }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)
  const isDisabled = isLoading || phaseComplete

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [value])

  const handleSend = () => {
    if (!value.trim() || isDisabled) return
    onSend(value)
    setValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-input-area">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className={`chat-input${phaseComplete ? ' phase-done' : ''}`}
          value={value}
          onChange={(e) => { if (!phaseComplete) setValue(e.target.value) }}
          onKeyDown={handleKeyDown}
          placeholder={phaseComplete
            ? 'Click "Continue to Phase …" above to proceed'
            : 'Paste your context or respond here… (Enter to send, Shift+Enter for new line)'}
          rows={1}
          disabled={isDisabled}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!value.trim() || isDisabled}
        >
          Send
        </button>
      </div>
      {!phaseComplete && <p className="input-hint">Enter to send · Shift+Enter for new line</p>}
    </div>
  )
}
