export const UNAUTHORIZED = 'UNAUTHORIZED'

// Holds the password before the server has confirmed it's valid.
// Written to sessionStorage only on first successful response.
let _pendingPassword = null

export function setPendingPassword(password) {
  _pendingPassword = password
}

export async function sendMessage(conversationHistory, phase = 1) {
  const password = _pendingPassword ?? sessionStorage.getItem('sharedPassword')
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
    _pendingPassword = null
    throw new Error(UNAUTHORIZED)
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error || `API error: ${response.status}`)
  }

  if (_pendingPassword) {
    sessionStorage.setItem('sharedPassword', _pendingPassword)
    _pendingPassword = null
  }

  const data = await response.json()
  if (!data?.text) throw new Error('Malformed response from server')
  return data.text
}
