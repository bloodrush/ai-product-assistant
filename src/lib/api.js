export const UNAUTHORIZED = 'UNAUTHORIZED'

export async function sendMessage(conversationHistory, phase = 1) {
  const password = sessionStorage.getItem('sharedPassword')
  if (!password) throw new Error(UNAUTHORIZED)

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-shared-password': password,
    },
    body: JSON.stringify({ conversationHistory, phase }),
  })

  if (response.status === 401) {
    throw new Error(UNAUTHORIZED)
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error || `API error: ${response.status}`)
  }

  const data = await response.json()
  if (!data?.text) throw new Error('Malformed response from server')
  return data.text
}
