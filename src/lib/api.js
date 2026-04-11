import { SYSTEM_PROMPT } from './systemPrompt.js'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const API_URL = 'https://api.anthropic.com/v1/messages'

// Switch to SONNET for production / real user testing
// Use HAIKU for development — ~5x cheaper, same API interface
const MODELS = {
  dev:  'claude-haiku-4-5-20251001',
  prod: 'claude-sonnet-4-20250514',
}
const MODEL = import.meta.env.VITE_APP_ENV === 'production' ? MODELS.prod : MODELS.dev

// System prompt with cache_control — tells Anthropic to cache this block.
// Cache writes cost 1.25x, cache reads cost 0.1x (10% of normal).
// Since the system prompt is identical on every call, every call after
// the first in a session reads from cache — ~90% saving on system prompt tokens.
const CACHED_SYSTEM = [
  {
    type: 'text',
    text: SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' },
  },
]

export async function sendMessage(conversationHistory) {
  if (!API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set. Check your .env file.')
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: CACHED_SYSTEM,
      messages: conversationHistory,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content[0].text
}

export { MODEL, MODELS }
