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
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

async function getNextId(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:A`,
  })
  const values = res.data.values ?? []
  // Row 1 is header, rows 2+ are data
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

async function createTranscriptDoc(drive, folderId, title, transcript, name, team, date) {
  const headerText = `AI Discovery Interview\nInterviewee: ${name ?? '—'}\nTeam: ${team ?? '—'}\nDate: ${date ?? '—'}\n\n`
  const body = headerText + (transcript ?? '')

  // Upload as text/plain with mimeType=Google Doc — Drive converts on ingest.
  // This avoids docs.documents.batchUpdate insertText which fails on service-account-created docs.
  const fileRes = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      ...(folderId ? { parents: [folderId] } : {}),
    },
    media: {
      mimeType: 'text/plain',
      body,
    },
    fields: 'id',
  })

  return `https://docs.google.com/document/d/${fileRes.data.id}`
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
    const folderId     = process.env.GOOGLE_DRIVE_FOLDER_ID ?? null
    const tabName      = process.env.GOOGLE_SHEET_TAB ?? 'AI Tracker'

    if (!spreadsheetId) throw new Error('GOOGLE_SHEET_ID is not set')

    const sheets = google.sheets({ version: 'v4', auth })
    const drive  = google.drive({ version: 'v3', auth })

    await ensureHeader(sheets, spreadsheetId, tabName)
    const nextId = await getNextId(sheets, spreadsheetId, tabName)

    // Create transcript doc
    const docTitle = `AI Interview — ${name ?? 'Unknown'} — ${team ?? '—'} — ${date ?? '—'}`
    const docUrl = await createTranscriptDoc(drive, folderId, docTitle, transcript, name, team, date)

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    const today = date ?? new Date().toLocaleDateString('en-GB')

    const flagNote = flags.length > 0
      ? `\nFlagged: ${flags.join('; ')}`
      : ''

    const rows = useCases.map((uc, idx) => {
      const rowNum = nextId + idx + 1  // +1 for header row
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
        `Transcript: ${docUrl}${flagNote}\n⚠ AI-proposed scores — confirm before finalising`,
      ]
    })

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:P`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    })

    return res.status(200).json({
      sheetUrl,
      docUrl,
      rowsAdded: rows.length,
    })
  } catch (err) {
    console.error('Export error:', err)
    return res.status(500).json({ error: err.message ?? 'Export failed' })
  }
}
