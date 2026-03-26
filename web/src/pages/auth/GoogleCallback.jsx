/**
 * GoogleCallback.jsx
 * Handles the redirect back from Google OAuth.
 * The API redirects to: /auth/callback?token=<jwt>&dest=<path>
 * Or on error:         /auth/callback?error=<message>
 */
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function GoogleCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const token = searchParams.get('token')
    const dest  = searchParams.get('dest') || '/'
    const error = searchParams.get('error')

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true })
      return
    }

    if (!token) {
      navigate('/login?error=missing_token', { replace: true })
      return
    }

    // Store token via auth context and navigate
    loginWithToken(token, dest)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4f2 0%, #e8f0ed 100%)',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '4px solid #e2eae7',
          borderTopColor: '#4a9080',
          animation: 'spin 0.8s linear infinite',
          marginBottom: 24,
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <p style={{ color: '#4a9080', fontWeight: 600, fontSize: 16, margin: 0 }}>
        Signing you in…
      </p>
      <p style={{ color: '#718096', fontSize: 14, marginTop: 8 }}>
        Just a moment while we set things up
      </p>
    </div>
  )
}
