import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { MustChangePasswordError, useAuth } from '../auth/access'

export function LoginPage() {
  const { session, login, changePassword } = useAuth()
  const navigate = useNavigate()
  const [userCode, setUserCode] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mustChange, setMustChange] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  function editCredentials(update: () => void) {
    update()
    if (mustChange) {
      setMustChange(false)
      setNewPassword('')
      setConfirm('')
      setError('')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (mustChange && newPassword !== confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    setBusy(true)
    try {
      if (mustChange) await changePassword(userCode, password, newPassword)
      else await login(userCode, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof MustChangePasswordError) {
        setMustChange(true)
        setError(err.message)
      } else setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit} className="card">
        <h2>Genisis</h2>
        <p className="muted">Sign in with your Genisis user</p>
        <label>
          User Name
          <input autoFocus value={userCode} onChange={(e) => editCredentials(() => setUserCode(e.target.value))} maxLength={10} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => editCredentials(() => setPassword(e.target.value))} maxLength={10} />
        </label>
        {mustChange && (
          <>
            <label>
              New Password
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} maxLength={10} />
            </label>
            <label>
              Confirm New Password
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} maxLength={10} />
            </label>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy || !userCode}>
          {busy ? 'Signing in…' : mustChange ? 'Change password & sign in' : 'Login'}
        </button>
      </form>
    </div>
  )
}
