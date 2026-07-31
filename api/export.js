import { google } from 'googleapis'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  })
}

async function findOrCreateFolder(drive, name, parentId) {
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const res = await drive.files.list({
    q: `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
  })
  if (res.data.files?.length > 0) return res.data.files[0].id

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  })
  return folder.data.id
}

function buildTranscript(name, team, date, messages) {
  const lines = [
    'AI Discovery Interview',
    `Interviewee: ${name ?? '—'}`,
    `Team: ${team ?? '—'}`,
    `Date: ${date ?? '—'}`,
    '',
    '---',
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const password = req.headers['x-shared-password']
  if (!password || password !== process.env.SHARED_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { session, messages = [] } = req.body ?? {}
  const { name, team, date } = session ?? {}

  const rootFolderId = process.env.GOOGLE_TRANSCRIPTS_FOLDER_ID
  if (!rootFolderId) return res.status(500).json({ error: 'GOOGLE_TRANSCRIPTS_FOLDER_ID is not set' })

  try {
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const docs  = google.docs({ version: 'v1', auth })

    const teamFolderName = team?.trim() || 'Unknown Team'
    const teamFolderId   = await findOrCreateFolder(drive, teamFolderName, rootFolderId)

    const docTitle = `AI Interview — ${name ?? 'Unknown'} — ${team ?? 'Unknown'} — ${date ?? new Date().toLocaleDateString('en-GB')}`

    const fileRes = await drive.files.create({
      requestBody: {
        name: docTitle,
        mimeType: 'application/vnd.google-apps.document',
        parents: [teamFolderId],
      },
      fields: 'id',
    })
    const docId = fileRes.data.id

    const transcript = buildTranscript(name, team, date, messages)
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{ insertText: { location: { index: 1 }, text: transcript } }],
      },
    })

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`
    return res.status(200).json({ docUrl })
  } catch (err) {
    console.error('Export error:', err)
    return res.status(500).json({ error: err.message ?? 'Export failed' })
  }
}
