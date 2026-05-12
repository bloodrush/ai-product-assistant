import { useState, useEffect } from 'react'
import { setPendingPassword } from '../lib/api.js'

export default function PasswordGate({ onSuccess, error }) {
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState(null)

  useEffect(() => { setLocalError(null) }, [error])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = password.trim()
    if (!trimmed) {
      setLocalError('Please enter a password.')
      return
    }
    setLocalError(null)
    setPendingPassword(trimmed)
    onSuccess()
  }

  return (
    <div className="password-gate">
      <form className="password-gate__form" onSubmit={handleSubmit}>
        <p className="password-gate__label">FORG</p>
        <h2 className="password-gate__title">Enter password to continue</h2>
        <input
          className="password-gate__input"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
        />
        {(localError || error) && <p className="password-gate__error">{localError || error}</p>}
        <button className="password-gate__btn" type="submit">Continue</button>
      </form>
    </div>
  )
}
