import { useState, useCallback, useEffect, useRef } from 'react'
import { sendMessage, UNAUTHORIZED } from '../lib/api.js'

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

export function useConversation(phase = 1, { onUnauthorized, initialMessages = [], initialDocSections = {} } = {}) {
  const [messages, setMessages] = useState(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [docSections, setDocSections] = useState(initialDocSections)
  const [phaseOutputReceived, setPhaseOutputReceived] = useState(
    () => initialMessages.some(m => m.role === 'assistant' && m.content?.includes('<output-card>'))
  )
  const isLoadingRef = useRef(false)
  const prevPhaseRef = useRef(phase)
  const skipNextPhaseResetRef = useRef(false)

  useEffect(() => {
    if (prevPhaseRef.current === phase) return
    prevPhaseRef.current = phase
    if (skipNextPhaseResetRef.current) {
      skipNextPhaseResetRef.current = false
      return
    }
    setMessages([])
    setError(null)
    setDocSections({})
    setPhaseOutputReceived(false)
  }, [phase])

  const sendUserMessage = useCallback(async (userText) => {
    const trimmed = userText.trim()
    if (!trimmed || isLoadingRef.current) return

    const userMessage = { role: 'user', content: trimmed }
    const updatedHistory = [...messages, userMessage]

    setMessages(updatedHistory)
    isLoadingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const assistantText = await sendMessage(updatedHistory, phase)
      const assistantMessage = { role: 'assistant', content: assistantText }

      setMessages(prev => [...prev, assistantMessage])

      const cardMatch = assistantText.match(/<output-card>([\s\S]*?)<\/output-card>/)
      if (cardMatch) {
        setDocSections(phase === 1
          ? parseDocSections(cardMatch[1].trim())
          : { rawText: cardMatch[1].trim() }
        )
        setPhaseOutputReceived(true)
      }
    } catch (err) {
      if (err.message === UNAUTHORIZED) {
        onUnauthorized?.()
      } else {
        setError(err.message)
      }
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [messages, phase, onUnauthorized])

  const injectPhaseOutput = useCallback((text) => {
    const assistantMessage = { role: 'assistant', content: text }
    setMessages(prev => [...prev, assistantMessage])
    const cardMatch = text.match(/<output-card>([\s\S]*?)<\/output-card>/)
    if (cardMatch) {
      setDocSections(phase === 1
        ? parseDocSections(cardMatch[1].trim())
        : { rawText: cardMatch[1].trim() }
      )
    }
    setPhaseOutputReceived(true)
  }, [phase])

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
    setDocSections({})
    setPhaseOutputReceived(false)
  }, [])

  const reinitialize = useCallback((msgs, sections) => {
    skipNextPhaseResetRef.current = true
    setMessages(msgs)
    setDocSections(sections)
    setPhaseOutputReceived(msgs.some(m => m.role === 'assistant' && m.content?.includes('<output-card>')))
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    docSections,
    phaseOutputReceived,
    sendUserMessage,
    injectPhaseOutput,
    reset,
    reinitialize,
  }
}
