import { google } from 'googleapis'

const TRACKER_COLS = [
  'ID', 'Date', 'Interviewee', 'Team',
  'Use case title', 'Description', 'Current process',
  'Frequency & volume', 'Time per instance', 'People / systems', 'Data readiness',
  'Impact (1–5)', 'Feasibility (1–5)', 'Priority score', 'Status', 'Notes',
]

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function getNextId(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:A`,
  })
  const values = res.data.values ?? []
  return Math.max(1, values.length)
}

async function ensureHeader(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:P1`,
  })
  const existing = res.data.values?.[0] ?? []
  if (existing.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [TRACKER_COLS] },
    })
  }
}

async function createTranscriptTab(sheets, spreadsheetId, name, team, date, transcript) {
  const tabTitle = `T — ${name ?? 'Unknown'} — ${date ?? '—'}`.slice(0, 100)

  // Add a new sheet tab
  const batchRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabTitle } } }],
    },
  })
  const sheetId = batchRes.data.replies[0].addSheet.properties.sheetId

  // Write header + transcript lines
  const header = [
    [`AI Discovery Interview`],
    [`Interviewee: ${name ?? '—'}`],
    [`Team: ${team ?? '—'}`],
    [`Date: ${date ?? '—'}`],
    [],
  ]
  const transcriptRows = (transcript ?? '').split('\n').map(line => [line])
  const allRows = [...header, ...transcriptRows]

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: allRows },
  })

  const tabUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`
  return tabUrl
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const password = req.headers['x-shared-password']
  if (!password || password !== process.env.SHARED_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { session, useCases = [], flags = [], transcript = '' } = req.body ?? {}
  const { name, team, date } = session ?? {}

  if (useCases.length === 0) {
    return res.status(400).json({ error: 'No use cases to export' })
  }

  try {
    const auth = getAuth()
    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    const tabName       = process.env.GOOGLE_SHEET_TAB ?? 'AI Tracker'

    if (!spreadsheetId) throw new Error('GOOGLE_SHEET_ID is not set')

    const sheets = google.sheets({ version: 'v4', auth })

    await ensureHeader(sheets, spreadsheetId, tabName)
    const nextId = await getNextId(sheets, spreadsheetId, tabName)

    const transcriptUrl = await createTranscriptTab(sheets, spreadsheetId, name, team, date, transcript).catch(e => {
      console.warn('createTranscriptTab failed (non-fatal):', e.message)
      return null
    })

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    const today = date ?? new Date().toLocaleDateString('en-GB')
    const flagNote = flags.length > 0 ? `Flagged: ${flags.join('; ')}` : ''

    const rows = useCases.map((uc, idx) => {
      const rowNum = nextId + idx + 1
      return [
        nextId + idx,
        today,
        name ?? '',
        team ?? '',
        uc.title ?? '',
        uc.description ?? '',
        uc.currentProcess ?? '',
        uc.frequency ?? '',
        uc.timePerInstance ?? '',
        uc.peopleAndSystems ?? '',
        uc.dataReadiness ?? '',
        uc.impactScore ?? '',
        uc.feasibilityScore ?? '',
        `=IFERROR(AVERAGE(L${rowNum},M${rowNum}),"")`,
        'Not started',
        [transcriptUrl ? `Transcript: ${transcriptUrl}` : '', '⚠ AI-proposed scores — confirm before finalising', flagNote].filter(Boolean).join('\n'),
      ]
    })

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:P`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    })

    return res.status(200).json({ sheetUrl, transcriptUrl, rowsAdded: rows.length })
  } catch (err) {
    console.error('Export error:', err)
    return res.status(500).json({ error: err.message ?? 'Export failed' })
  }
}
