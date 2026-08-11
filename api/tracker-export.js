import { google } from 'googleapis'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const HEADERS = [
  'ID', 'Date', 'Team', 'Facilitator', 'Use Case Title', 'Description',
  'Current Process', 'Frequency', 'Time Impact', 'People / Systems',
  'Data Readiness', 'Impact Score', 'Feasibility Score', 'Priority Score',
  'Status', 'Score Status', 'Evidence', 'Notes',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const password = req.headers['x-shared-password']
  if (!password || password !== process.env.SHARED_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { team, generatedDate, useCases } = req.body ?? {}
  if (!team || !Array.isArray(useCases) || useCases.length === 0) {
    return res.status(400).json({ error: 'team and useCases are required' })
  }

  const sheetId = process.env.GOOGLE_TRACKER_SHEET_ID ?? process.env.GOOGLE_SHEET_ID
  if (!sheetId) return res.status(500).json({ error: 'GOOGLE_TRACKER_SHEET_ID is not set' })

  try {
    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Use the configured tab name, falling back to the first sheet's actual title
    let sheetTitle = process.env.GOOGLE_SHEET_TAB
    if (!sheetTitle) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
      sheetTitle = meta.data.sheets[0]?.properties?.title ?? 'Sheet1'
    }
    const range = `${sheetTitle}!A:R`

    // Check if the sheet already has a header row
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetTitle}!A1`,
    })
    const hasHeaders = !!(existing.data.values?.[0]?.[0])

    const date = generatedDate ?? new Date().toISOString().slice(0, 10)
    const dateTag = date.replace(/-/g, '')

    const teamSlug = team.replace(/\s+/g, '-').slice(0, 12)
    const dataRows = useCases.map((uc, i) => {
      const id = `AGG-${dateTag}-${teamSlug}-${String(i + 1).padStart(3, '0')}`
      const impact = Number(uc.impactScore) || 0
      const feasibility = Number(uc.feasibilityScore) || 0
      const priority = Math.round((impact * feasibility / 25) * 5 * 10) / 10
      return [
        id,
        date,
        team,
        'AI interview — aggregated',
        uc.title ?? '',
        uc.description ?? '',
        uc.currentProcess ?? '',
        uc.frequency ?? '',
        uc.estimatedTimeImpact ?? '',
        uc.peopleAndSystems ?? '',
        uc.dataReadiness ?? '',
        impact === 0 ? '' : impact,
        feasibility === 0 ? '' : feasibility,
        priority === 0 ? '' : priority,
        'Not started',
        'AI-proposed',
        uc.evidence ?? '',
        uc.lowEvidence ? 'Low evidence — 1 mention only' : '',
      ]
    })

    const values = hasHeaders ? dataRows : [HEADERS, ...dataRows]

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    })

    return res.status(200).json({
      rowsAdded: dataRows.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
    })
  } catch (err) {
    console.error('Tracker export error:', err)
    return res.status(500).json({ error: err.message ?? 'Export failed' })
  }
}
