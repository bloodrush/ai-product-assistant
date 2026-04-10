import { useState, useCallback } from 'react'
import { sendMessage } from '../lib/api.js'

export function useConversation() {
  const [messages, setMessages] = useState([]) // { role: 'user'|'assistant', content: string }
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [phase1Complete, setPhase1Complete] = useState(false)

  const sendUserMessage = useCallback(async (userText) => {
    if (!userText.trim() || isLoading) return

    const userMessage = { role: 'user', content: userText.trim() }
    const updatedHistory = [...messages, userMessage]

    setMessages(updatedHistory)
    setIsLoading(true)
    setError(null)

    try {
      const assistantText = await sendMessage(updatedHistory)
      const assistantMessage = { role: 'assistant', content: assistantText }

      setMessages(prev => [...prev, assistantMessage])

      // Detect phase 1 completion
      if (assistantText.includes('<output-card>')) {
        setPhase1Complete(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading])

  return {
    messages,
    isLoading,
    error,
    phase1Complete,
    sendUserMessage,
  }
}
