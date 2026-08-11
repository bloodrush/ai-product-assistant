import { google } from 'googleapis'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = process.env.APP_ENV === 'production'
  ? 'claude-sonnet-4-6'
  : 'claude-haiku-4-5-20251001'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/documents.readonly'],
  })
}

function extractTranscriptsForTeam(bodyContent, targetTeam) {
  const fullText = bodyContent
    .flatMap(el => (el.paragraph?.elements ?? []).map(pe => pe.textRun?.content ?? ''))
    .join('')

  const HEADER = 'AI Discovery Interview\n'
  const parts = fullText.split(HEADER)
  const teamNorm = targetTeam.trim().toLowerCase()

  return parts.slice(1).filter(section => {
    const m = section.match(/^Team:\s*(.+)$/m)
    return m && m[1].trim().toLowerCase() === teamNorm
  }).map(section => HEADER + section)
}

const SYSTEM_PROMPT = `You are a senior product analyst specializing in AI automation opportunities. Analyze multiple interview transcripts from the same team to identify recurring pain points and high-value use cases.

Output ONLY valid JSON (no markdown fences, no prose outside the JSON) with this exact structure:
{
  "useCases": [
    {
      "title": "string (5–10 words)",
      "description": "string (2–3 sentences)",
      "evidence": "Mentioned by N of M interviewees",
      "mentionCount": N,
      "currentProcess": "string (composite from multiple accounts)",
      "frequency": "string",
      "estimatedTimeImpact": "string",
      "peopleAndSystems": "string",
      "dataReadiness": "string",
      "impactScore": 1,
      "impactRationale": "string (1–2 sentences citing interview evidence)",
      "feasibilityScore": 1,
      "feasibilityRationale": "string (1–2 sentences citing specific factors)",
      "lowEvidence": false
    }
  ],
  "flags": ["string"],
  "summary": "string (3–5 sentences)"
}

Rules:
- A use case is recurring if 2+ interviewees mentioned it independently — these are the primary findings
- Single-mention use cases: include them but set lowEvidence: true
- evidence must cite exact counts e.g. "Mentioned by 8 of 12 interviewees"
- Sort by mentionCount descending, then impactScore descending
- impactScore 1–5: 1=negligible time saved, 2=minor, 3=moderate, 4=significant, 5=transformative
- feasibilityScore 1–5: 1=very complex (unstructured data, deep integration), 2=complex, 3=moderate, 4=feasible, 5=straightforward (structured data, clear rules)
- flags: sensitive topics appearing across interviews (PII, compliance, third-party data restrictions)
- summary: narrative synthesizing the team's biggest pain points and top AI opportunities`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const password = req.headers['x-shared-password']
  const validPasswords = [process.env.SHARED_PASSWORD, process.env.INTERVIEW_PASSWORD].filter(Boolean)
  if (!password || !validPasswords.includes(password)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { team } = req.body ?? {}
  if (!team || typeof team !== 'string') {
    return res.status(400).json({ error: 'team is required' })
  }

  const docId = process.env.GOOGLE_TRANSCRIPT_DOC_ID
  if (!docId) return res.status(500).json({ error: 'GOOGLE_TRANSCRIPT_DOC_ID is not set' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server misconfigured' })

  try {
    const auth = getAuth()
    const docs = google.docs({ version: 'v1', auth })

    const { data: docData } = await docs.documents.get({ documentId: docId })
    const bodyContent = docData.body?.content ?? []

    const transcripts = extractTranscriptsForTeam(bodyContent, team)

    if (transcripts.length === 0) {
      return res.status(404).json({ error: `No transcripts found for team: ${team}` })
    }

    const interviewCount = transcripts.length
    const combined = transcripts
      .map((t, i) => `=== Interview ${i + 1} of ${interviewCount} ===\n${t}`)
      .join('\n\n')

    if (combined.length > 400_000) {
      return res.status(400).json({
        error: `Transcript payload too large for team "${team}" (${interviewCount} interviews, ${combined.length} chars). Split into batches.`,
      })
    }

    const userMessage = `Here are ${interviewCount} interview transcript${interviewCount === 1 ? '' : 's'} from the "${team}" team. Identify recurring patterns and produce the JSON analysis.\n\n${combined}`

    const aiRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!aiRes.ok) {
      const errBody = await aiRes.json().catch(() => ({}))
      return res.status(502).json({ error: errBody?.error?.message || `API error: ${aiRes.status}` })
    }

    const aiData = await aiRes.json()
    const text = aiData?.content?.[0]?.text
    if (!text) return res.status(502).json({ error: 'Empty response from model' })

    // Strip markdown fences if model adds them despite instructions
    const cleaned = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Model returned invalid JSON:', cleaned.slice(0, 200))
      return res.status(502).json({ error: 'Model returned invalid JSON' })
    }

    return res.status(200).json({
      team,
      interviewCount,
      generatedDate: new Date().toISOString().slice(0, 10),
      useCases: parsed.useCases ?? [],
      flags: parsed.flags ?? [],
      summary: parsed.summary ?? '',
    })
  } catch (err) {
    console.error('Aggregate error:', err)
    return res.status(500).json({ error: err.message ?? 'Aggregation failed' })
  }
}
