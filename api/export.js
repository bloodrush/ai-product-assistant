import { google } from 'googleapis'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/documents'],
  })
}

function buildTranscript(name, team, date, messages) {
  const lines = [
    'AI Discovery Interview',
    `Interviewee: ${name ?? '—'}`,
    `Team: ${team ?? '—'}`,
    `Date: ${date ?? '—'}`,
    '',
  ]
  messages.forEach(m => {
    const label = m.role === 'assistant' ? 'Interviewer' : 'Interviewee'
    const content = m.content
      .replace(/<output-card>[\s\S]*?<\/output-card>/g, '[Summary card generated]')
      .trim()
    lines.push(`${label}:`)
    lines.push(content)
    lines.push('')
  })
  return lines.join('\n')
}

// Unique divider that separates the Sessions index from the Transcripts section.
// Uses box-drawing chars so it won't appear in normal interview text.
const DIVIDER = '════════════════════════════════════════'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const password = req.headers['x-shared-password']
  if (!password || password !== process.env.SHARED_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { session, messages = [] } = req.body ?? {}
  const { name, team, date } = session ?? {}

  console.log('export called — name:', name, 'team:', team, 'msgCount:', messages.length)

  const docId = process.env.GOOGLE_TRANSCRIPT_DOC_ID
  if (!docId) return res.status(500).json({ error: 'GOOGLE_TRANSCRIPT_DOC_ID is not set' })

  try {
    const auth = getAuth()
    const docs = google.docs({ version: 'v1', auth })

    const { data } = await docs.documents.get({ documentId: docId })
    const bodyContent = data.body?.content ?? []

    const displayDate = date ?? new Date().toLocaleDateString('en-GB')
    const tocEntry = `• ${name ?? '—'} — ${team ?? '—'} — ${displayDate}\n`
    const transcript = buildTranscript(name, team, date, messages)

    // Concatenate all text to check if the doc is effectively empty.
    const docText = bodyContent
      .flatMap(el => (el.paragraph?.elements ?? []).map(pe => pe.textRun?.content ?? ''))
      .join('')

    // endIndex of the last structural element (always a trailing \n in Docs).
    const lastEndIndex = bodyContent[bodyContent.length - 1]?.endIndex ?? 2

    let requests

    if (docText.trim() === '') {
      // Fresh doc — write the initial structure in one shot.
      const initText = `Sessions\n\n${tocEntry}\n${DIVIDER}\n\nTranscripts\n\n${transcript}\n`
      requests = [{ insertText: { location: { index: 1 }, text: initText } }]
    } else {
      // Find the divider paragraph to know where the Sessions section ends.
      let dividerStartIndex = null
      for (const el of bodyContent) {
        if (!el.paragraph) continue
        const paraText = (el.paragraph.elements ?? [])
          .map(pe => pe.textRun?.content ?? '')
          .join('')
        if (paraText.trimEnd() === DIVIDER) {
          dividerStartIndex = el.startIndex
          break
        }
      }

      if (dividerStartIndex == null) {
        // Divider missing — fall back to appending at the end.
        requests = [{
          insertText: { location: { index: lastEndIndex - 1 }, text: `\n${transcript}\n` },
        }]
      } else {
        // Apply highest-index insertion first so lower indices stay valid.
        // 1. Append transcript before the document's trailing newline.
        // 2. Insert TOC entry right before the divider (inside Sessions section).
        requests = [
          { insertText: { location: { index: lastEndIndex - 1 }, text: `\n${transcript}\n` } },
          { insertText: { location: { index: dividerStartIndex }, text: tocEntry } },
        ]
      }
    }

    await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } })

    return res.status(200).json({ docUrl: `https://docs.google.com/document/d/${docId}/edit` })
  } catch (err) {
    console.error('Export error:', err)
    return res.status(500).json({ error: err.message ?? 'Export failed' })
  }
}
