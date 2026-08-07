import { google } from 'googleapis'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/documents'],
  })
}

// Returns { text, boldRanges } where boldRanges are [startOffset, endOffset] pairs
// (endOffset is exclusive, matching the Docs API convention).
function buildTranscriptData(name, team, date, messages) {
  const segments = []
  const add = (text, bold = false) => segments.push({ text, bold })

  add('AI Discovery Interview\n', true)
  add(`Interviewee: ${name ?? '—'}\n`)
  add(`Team: ${team ?? '—'}\n`)
  add(`Date: ${date ?? '—'}\n`)
  add('\n')

  messages.forEach(m => {
    const label = m.role === 'assistant' ? 'Interviewer' : 'Interviewee'
    const content = m.content
      .replace(/<output-card>[\s\S]*?<\/output-card>/g, '[Summary card generated]')
      .trim()
    add(`${label}:\n`, true)
    add(`${content}\n\n`)
  })

  let text = ''
  const boldRanges = []
  for (const seg of segments) {
    const start = text.length
    text += seg.text
    // Bold range excludes the trailing \n so only the label text is bolded.
    if (seg.bold) boldRanges.push([start, text.length - 1])
  }

  return { text, boldRanges }
}

function makeBoldRequests(baseDocIndex, boldRanges) {
  return boldRanges.map(([start, end]) => ({
    updateTextStyle: {
      range: { startIndex: baseDocIndex + start, endIndex: baseDocIndex + end },
      textStyle: { bold: true },
      fields: 'bold',
    },
  }))
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
    const { text: transcript, boldRanges } = buildTranscriptData(name, team, date, messages)

    // Concatenate all text to check if the doc is effectively empty.
    const docText = bodyContent
      .flatMap(el => (el.paragraph?.elements ?? []).map(pe => pe.textRun?.content ?? ''))
      .join('')

    // endIndex of the last structural element (always a trailing \n in Docs).
    const lastEndIndex = bodyContent[bodyContent.length - 1]?.endIndex ?? 2

    let requests

    if (docText.trim() === '') {
      // Fresh doc — write the initial structure in one shot.
      const prefix = `Sessions\n\n${tocEntry}\n${DIVIDER}\n\nTranscripts\n\n`
      const initText = prefix + transcript + '\n'
      // Transcript starts at index 1 + prefix.length after insertion.
      const transcriptDocStart = 1 + prefix.length
      requests = [
        { insertText: { location: { index: 1 }, text: initText } },
        ...makeBoldRequests(transcriptDocStart, boldRanges),
      ]
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
        // The prepended \n lands at lastEndIndex - 1; transcript follows at lastEndIndex.
        const transcriptDocStart = lastEndIndex
        requests = [
          { insertText: { location: { index: lastEndIndex - 1 }, text: `\n${transcript}\n` } },
          ...makeBoldRequests(transcriptDocStart, boldRanges),
        ]
      } else {
        // Apply highest-index insertion first so lower indices stay valid.
        // 1. Append transcript before the document's trailing newline.
        // 2. Insert TOC entry right before the divider (inside Sessions section).
        // After both insertions the transcript sits at lastEndIndex + tocEntry.length
        // because the TOC insertion (at dividerStartIndex < lastEndIndex) shifts it right.
        const transcriptDocStart = lastEndIndex + tocEntry.length
        requests = [
          { insertText: { location: { index: lastEndIndex - 1 }, text: `\n${transcript}\n` } },
          { insertText: { location: { index: dividerStartIndex }, text: tocEntry } },
          ...makeBoldRequests(transcriptDocStart, boldRanges),
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
