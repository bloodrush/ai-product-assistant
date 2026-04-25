import { useState, useCallback } from 'react'
import { sendMessage } from '../lib/api.js'

function parseDocSections(cardContent) {
  const get = (label) => {
    const r = new RegExp(`\\*\\*${label}\\*\\*\\n([\\s\\S]*?)(?=\\n\\*\\*|$)`)
    const m = cardContent.match(r)
    return m ? m[1].trim() : null
  }
  return {
    problem:   get('Problem'),
    affected:  get('Who is affected'),
    mustHaves: get('Must-haves'),
    noGoes:    get('No-goes'),
    whatGood:  get('What good looks like'),
  }
}

export function useConversation(phase = 1) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [phase1Complete, setPhase1Complete] = useState(false)
  const [docSections, setDocSections] = useState({})

  const sendUserMessage = useCallback(async (userText) => {
    if (!userText.trim() || isLoading) return

    const userMessage = { role: 'user', content: userText.trim() }
    const updatedHistory = [...messages, userMessage]

    setMessages(updatedHistory)
    setIsLoading(true)
    setError(null)

    try {
      const assistantText = await sendMessage(updatedHistory, phase)
      const assistantMessage = { role: 'assistant', content: assistantText }

      setMessages(prev => [...prev, assistantMessage])

      // Detect phase 1 completion and parse doc sections
      const cardMatch = assistantText.match(/<output-card>([\s\S]*?)<\/output-card>/)
      if (cardMatch) {
        setPhase1Complete(true)
        setDocSections(parseDocSections(cardMatch[1].trim()))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading, phase])

  return {
    messages,
    isLoading,
    error,
    phase1Complete,
    docSections,
    sendUserMessage,
  }
}
