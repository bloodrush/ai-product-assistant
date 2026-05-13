import { getSystemPrompt } from '../src/lib/prompts/index.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = process.env.APP_ENV === 'production'
  ? 'claude-sonnet-4-6'
  : 'claude-haiku-4-5-20251001'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.setHeader('Allow', 'POST').status(405).end()

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const password = req.headers['x-shared-password']
  if (!password || password !== process.env.SHARED_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request' })
  }

  const { conversationHistory, phase } = req.body

  if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  if (conversationHistory.length > 100) {
    return res.status(400).json({ error: 'Conversation too long' })
  }
  const safePhase = Number.isInteger(phase) && phase >= 1 && phase <= 5 ? phase : 1

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: getSystemPrompt(safePhase),
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: conversationHistory,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return res.status(502).json({ error: error?.error?.message || `API error: ${response.status}` })
    }

    const data = await response.json()
    const text = data?.content?.[0]?.text
    if (!text) return res.status(502).json({ error: 'Empty response from model' })
    return res.status(200).json({ text })
  } catch {
    return res.status(502).json({ error: 'Failed to reach Anthropic API' })
  }
}
