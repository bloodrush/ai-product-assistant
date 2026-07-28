import { useState, useCallback, useEffect, useRef } from 'react'
import { sendMessage, UNAUTHORIZED } from '../lib/api.js'

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseDocSections(cardContent) {
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

export function parseAiDiscoveryCard(cardContent) {
  const sections = cardContent.split(/\n\s*-{3,}\s*\n/).map(s => s.trim()).filter(Boolean)

  // Session metadata — first section
  const metaSection = sections[0] || ''
  const getLine = (label) => {
    const m = metaSection.match(new RegExp(`^${escapeRegex(label)}:\\s*(.+)$`, 'm'))
    return m ? m[1].trim() : null
  }

  const name = getLine('Name')
  const team = getLine('Team')
  const date = getLine('Date')

  const useCases = []
  const flags = []

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i]

    // Flag section — collect all flag lines
    const flagMatches = [...section.matchAll(/^⚠\s*Flagged for review:\s*(.+)$/gm)]
    if (flagMatches.length > 0) {
      flagMatches.forEach(m => flags.push(m[1].trim()))
      continue
    }

    // Use case section
    const titleMatch = section.match(/^\*\*Use case:\s*(.+?)\*\*/)
    if (!titleMatch) continue

    const title = titleMatch[1].trim()

    // Capture field value from "Label: ..." up to the next field label or end
    const getField = (label) => {
      const r = new RegExp(
        `(?:^|\\n)${escapeRegex(label)}:\\s*([\\s\\S]*?)(?=\\n[A-Z][^\\n]*:|\\n⚠|$)`
      )
      const m = section.match(r)
      return m ? m[1].trim() : null
    }

    // Score lines: "Impact (1–5): 4 — rationale" — handle en/em/hyphen dashes
    const impactLine = section.match(/Impact\s*\(1[–\-—]5\):\s*(\d)\s*[—\-–]\s*(.+)/m)
    const feasLine   = section.match(/Feasibility\s*\(1[–\-—]5\):\s*(\d)\s*[—\-–]\s*(.+)/m)

    useCases.push({
      title,
      description:          getField('Description'),
      currentProcess:       getField('Current process'),
      frequency:            getField('Frequency & volume'),
      timePerInstance:      getField('Time per instance'),
      peopleAndSystems:     getField('People / systems involved'),
      dataReadiness:        getField('Data readiness'),
      impactScore:          impactLine ? parseInt(impactLine[1], 10) : null,
      impactRationale:      impactLine ? impactLine[2].trim()        : null,
      feasibilityScore:     feasLine   ? parseInt(feasLine[1],   10) : null,
      feasibilityRationale: feasLine   ? feasLine[2].trim()          : null,
    })
  }

  return { name, team, date, useCases, flags }
}

function parseCard(cardContent, mode, phase) {
  if (mode === 'ai-discovery') return parseAiDiscoveryCard(cardContent)
  if (phase === 1) return parseDocSections(cardContent)
  return { rawText: cardContent }
}

export function useConversation(phase = 1, { onUnauthorized, initialMessages = [], initialDocSections = {}, mode = 'product' } = {}) {
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
      const assistantText = await sendMessage(updatedHistory, phase, mode)
      const assistantMessage = { role: 'assistant', content: assistantText }

      setMessages(prev => [...prev, assistantMessage])

      const cardMatch = assistantText.match(/<output-card>([\s\S]*?)<\/output-card>/)
      if (cardMatch) {
        setDocSections(parseCard(cardMatch[1].trim(), mode, phase))
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
  }, [messages, phase, mode, onUnauthorized])

  const injectPhaseOutput = useCallback((text) => {
    const assistantMessage = { role: 'assistant', content: text }
    setMessages(prev => [...prev, assistantMessage])
    const cardMatch = text.match(/<output-card>([\s\S]*?)<\/output-card>/)
    if (cardMatch) {
      setDocSections(parseCard(cardMatch[1].trim(), mode, phase))
    }
    setPhaseOutputReceived(true)
  }, [phase, mode])

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
