import { google } from 'googleapis'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = process.env.APP_ENV === 'production'
  ? 'claude-sonnet-4-6'
  : 'claude-haiku-4-5-20251001'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  let credentials
  try { credentials = JSON.parse(raw) } catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON') }
  return new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/documents.readonly'] })
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

const DEV_SAMPLE_RESPONSE = (team) => ({
  team,
  interviewCount: 3,
  generatedDate: new Date().toISOString().slice(0, 10),
  summary: '[Dev sample] Three Finance Operations interviews surfaced four recurring manual processes. Month-end reconciliation and vendor invoice handling were mentioned by all three interviewees and represent the highest combined time impact. FX exposure reporting and supplier screening each appeared twice and are strong secondary candidates.',
  useCases: [
    {
      title: 'Month-end reconciliation automation',
      description: 'Analysts spend 2–3 days each month manually matching transactions across SAP, bank portals, and Excel. The process is well-structured and data sources are consistent, making it a strong automation candidate.',
      evidence: 'Mentioned by 3 of 3 interviewees',
      mentionCount: 3,
      currentProcess: 'Export from SAP and three bank portals, paste into Excel, run VLOOKUPs, flag exceptions, email controller.',
      frequency: 'Monthly — 800–1,200 transactions per cycle',
      estimatedTimeImpact: '4–6 analyst-days per month',
      peopleAndSystems: '2 finance analysts, 1 financial controller. SAP, three banking portals, Excel.',
      dataReadiness: 'SAP exports are structured and consistent. Bank CSVs vary in format across portals.',
      impactScore: 5,
      impactRationale: 'Eliminates 4–6 analyst-days of manual work per month across two roles.',
      feasibilityScore: 4,
      feasibilityRationale: 'SAP and bank data are well-structured; main challenge is normalising varying CSV formats across three portals.',
      lowEvidence: false,
    },
    {
      title: 'Vendor invoice exception triage',
      description: 'Around 50 invoices per week fail PO matching in SAP and require manual investigation via shared email inbox, often involving back-and-forth with procurement or the vendor.',
      evidence: 'Mentioned by 3 of 3 interviewees',
      mentionCount: 3,
      currentProcess: 'Check shared inbox daily, compare against SAP PO data, contact procurement or vendor by email, update SAP manually, post corrected invoice.',
      frequency: '40–60 exceptions/week, rising to 100+ at quarter-end',
      estimatedTimeImpact: '15–45 minutes per exception; up to 45 analyst-hours per week at peak',
      peopleAndSystems: '3 AP analysts, procurement team, external vendors. SAP, shared email inbox.',
      dataReadiness: 'PO and invoice data in SAP is well-structured. Exception history and resolution rationale exist only in email threads.',
      impactScore: 4,
      impactRationale: 'High volume with significant peak-period burden; automating triage and routing could cut resolution time by 50–70%.',
      feasibilityScore: 3,
      feasibilityRationale: 'Structured SAP data is workable, but resolution history in email makes training a classifier harder without a logging system.',
      lowEvidence: false,
    },
    {
      title: 'Weekly FX exposure report',
      description: 'A single treasury analyst manually compiles the FX report each week from six bank portals and Bloomberg, taking 3–4 hours.',
      evidence: 'Mentioned by 2 of 3 interviewees',
      mentionCount: 2,
      currentProcess: 'Log into six bank portals, download balances, paste into Excel, manually enter Bloomberg FX rates, calculate net exposure, email to CFO.',
      frequency: 'Weekly, plus ad hoc on volatile days',
      estimatedTimeImpact: '3–4 hours/week plus ad hoc instances',
      peopleAndSystems: '1 treasury analyst, CFO. Six bank portals, Bloomberg terminal, Excel.',
      dataReadiness: 'Bank balances are accurate but spread across six portals with inconsistent formats. Bloomberg rates are reliable but no API access currently provisioned.',
      impactScore: 3,
      impactRationale: 'Saves 3–4 hours weekly and enables real-time CFO visibility; impact constrained by single-person scope.',
      feasibilityScore: 3,
      feasibilityRationale: 'Main blocker is Bloomberg API access, which is not yet provisioned and requires procurement approval.',
      lowEvidence: false,
    },
    {
      title: 'New supplier compliance screening',
      description: 'Each new supplier requires manual lookup against two internal Excel blacklists and a government sanctions database before SAP onboarding.',
      evidence: 'Mentioned by 1 of 3 interviewees',
      mentionCount: 1,
      currentProcess: 'Receive supplier details by email, search two Excel blacklists, look up sanctions website manually, record outcome in Word, email result to procurement.',
      frequency: '10–15 new suppliers per month',
      estimatedTimeImpact: '30–60 minutes per supplier; up to 15 hours/month',
      peopleAndSystems: '1 AP analyst, procurement team. Two internal Excel spreadsheets, government sanctions website, Word, email.',
      dataReadiness: 'Internal exclusion lists are in Excel and not always current. Government sanctions database supports only individual manual lookups — no batch API.',
      impactScore: 3,
      impactRationale: 'Moderate volume but compliance risk means errors are costly; automation reduces human error as much as time.',
      feasibilityScore: 3,
      feasibilityRationale: 'Government database lacks a batch API, requiring a workaround or web scraping; internal lists need consolidation first.',
      lowEvidence: true,
    },
  ],
  flags: [
    'Vendor and supplier PII flows through shared email inboxes — no audit trail. Assess data handling compliance before automating.',
    'Bloomberg data redistribution rights may restrict use in automated pipelines — confirm licensing before building the FX report automation.',
  ],
})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const password = req.headers['x-shared-password']
  if (!password || password !== process.env.SHARED_PASSWORD) {
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
      if (process.env.APP_ENV !== 'production') {
        return res.status(200).json(DEV_SAMPLE_RESPONSE(team))
      }
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

    // Extract the JSON object even if the model wraps it in prose or fences
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) {
      console.error('Model response contains no JSON object:', text.slice(0, 200))
      return res.status(502).json({ error: 'Model returned invalid JSON' })
    }
    const cleaned = text.slice(start, end + 1)

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
