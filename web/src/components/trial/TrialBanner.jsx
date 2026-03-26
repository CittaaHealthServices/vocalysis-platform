/**
 * TrialBanner
 * Shows remaining trial days at the top of every dashboard.
 * Only renders when the API reports an active trial.
 */
import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, X, ArrowRight } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

const ALWAYS_BYPASS = ['CITTAA_SUPER_ADMIN', 'CITTAA_CEO']

export default function TrialBanner() {
  const { user } = useAuth()
  const [trial, setTrial] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user || ALWAYS_BYPASS.includes(user.role)) return

    api.get('/trial/status')
      .then(res => {
        if (res?.success && res.data?.isTrial && res.data?.isActive) {
          setTrial(res.data)
        }
      })
      .catch(() => {}) // silently fail — don't block UI
  }, [user])

  if (!trial || dismissed) return null

  const { daysLeft, endDate } = trial
  const urgent = daysLeft <= 3

  const formattedEnd = endDate
    ? new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div
      style={{
        background: urgent
          ? 'linear-gradient(90deg, #fff3cd 0%, #ffeaa0 100%)'
          : 'linear-gradient(90deg, #e8f4f0 0%, #deeee9 100%)',
        borderBottom: `2px solid ${urgent ? '#f59e0b' : '#4a9080'}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {urgent
        ? <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
        : <Clock size={16} color="#4a9080" style={{ flexShrink: 0 }} />
      }

      <span style={{ color: urgent ? '#92400e' : '#1a4a3a', fontWeight: 500, flex: 1 }}>
        {daysLeft === 0
          ? 'Your trial has ended. Please contact your administrator to continue.'
          : daysLeft === 1
          ? 'Your trial ends today! Reach out to upgrade and keep your progress.'
          : `You have ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your trial`
        }
        {formattedEnd && daysLeft > 1 && (
          <span style={{ fontWeight: 400, opacity: 0.75 }}> — expires {formattedEnd}</span>
        )}
      </span>

      {daysLeft > 0 && (
        <a
          href="mailto:hello@cittaa.in?subject=Upgrading from Trial"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: urgent ? '#d97706' : '#4a9080',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            padding: '4px 10px',
            borderRadius: 6,
            border: `1px solid ${urgent ? '#f59e0b' : '#4a9080'}`,
            fontSize: 13,
          }}
        >
          Upgrade <ArrowRight size={13} />
        </a>
      )}

      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          color: urgent ? '#92400e' : '#4a9080',
          opacity: 0.6,
          flexShrink: 0,
        }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
