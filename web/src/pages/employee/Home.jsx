/**
 * Employee Wellness Home — the heart of the employee experience.
 * Features Voca Voice™ (ElevenLabs AI) for personalised audio wellness feedback.
 */
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/ui'
import { VocaVoicePlayer } from '../../components/audio/VocaVoicePlayer'
import api from '../../services/api'
import {
  Activity, BookOpen, Calendar, TrendingUp,
  Heart, ArrowRight, Flame, Star,
} from 'lucide-react'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function ScoreRing({ score }) {
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const color =
    pct >= 70 ? '#16a34a' :
    pct >= 50 ? '#d97706' :
    pct >= 35 ? '#ea580c' : '#dc2626'

  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="absolute inset-0" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} stroke="#f3f4f6" strokeWidth="8" fill="none" />
        <circle
          cx="48" cy="48" r={r}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-xl font-bold" style={{ color }}>{score != null ? score : '—'}</p>
        <p className="text-[10px] text-gray-400 font-medium leading-none">/ 100</p>
      </div>
    </div>
  )
}

function QuickActionCard({ icon: Icon, label, sub, color, onClick }) {
  const colors = {
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100', hover: 'hover:bg-violet-100' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  border: 'border-green-100',  hover: 'hover:bg-green-100' },
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-100',   hover: 'hover:bg-blue-100' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  border: 'border-amber-100',  hover: 'hover:bg-amber-100' },
  }
  const c = colors[color] || colors.violet
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${c.bg} ${c.border} ${c.hover} transition-colors text-center w-full`}
    >
      <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </button>
  )
}

export const MyWellnessHome = () => {
  const navigate = useNavigate()
  const { user }  = useAuth()

  const { data: summaryData, isLoading } = useApi(
    ['my-wellness-summary'],
    () => api.get('/sessions/my/summary').catch(() => null),
    { retry: 0 }
  )

  const { data: sessionsData } = useApi(
    ['my-recent-sessions'],
    () => api.get('/sessions/my', { params: { limit: 30 } }).catch(() => null),
    { retry: 0 }
  )

  if (isLoading) return <LoadingScreen />

  const summary       = summaryData?.data || summaryData || {}
  const wellnessScore = summary.latestScore ?? summary.wellnessScore ?? null
  const riskLevel     = summary.riskLevel || 'LOW'
  const sessions      = sessionsData?.data?.sessions || sessionsData?.data || []
  const totalSessions = summary.totalSessions ?? sessions.length ?? 0

  const streakDays = (() => {
    if (!sessions.length) return 0
    const dates = [...new Set(sessions.map(s =>
      new Date(s.completedAt || s.createdAt).toDateString()
    ))].sort((a, b) => new Date(b) - new Date(a))

    let streak = 0
    let expected = new Date()
    expected.setHours(0, 0, 0, 0)

    for (const d of dates) {
      const day = new Date(d)
      day.setHours(0, 0, 0, 0)
      if (day.getTime() === expected.getTime()) {
        streak++
        expected.setDate(expected.getDate() - 1)
      } else {
        break
      }
    }
    return streak
  })()

  const firstName = user?.firstName || 'there'
  const greeting  = getGreeting()

  const riskColors = {
    LOW:      { bg: 'bg-green-100',  text: 'text-green-700',  label: '✅ Low Risk' },
    MODERATE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '⚠️ Moderate Risk' },
    HIGH:     { bg: 'bg-orange-100', text: 'text-orange-700', label: '🔶 High Risk' },
    CRITICAL: { bg: 'bg-red-100',    text: 'text-red-700',    label: '🚨 Critical' },
  }
  const riskStyle = riskColors[riskLevel] || riskColors.LOW

  return (
    <div className="max-w-2xl space-y-6">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">How are you feeling today?</p>
        </div>
        {streakDays >= 2 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-xl">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-orange-600">{streakDays} day streak!</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-5">
          <ScoreRing score={wellnessScore} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-500 mb-1">Your Wellness Score</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskStyle.bg} ${riskStyle.text}`}>
                {riskStyle.label}
              </span>
              {totalSessions > 0 && (
                <span className="text-xs text-gray-400">{totalSessions} check-in{totalSessions !== 1 ? 's' : ''} completed</span>
              )}
            </div>
            {wellnessScore === null && (
              <p className="text-xs text-gray-400 mt-2">Complete your first check-in to see your score</p>
            )}
          </div>
        </div>

        <button
          onClick={() => navigate('/my/check-in')}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Activity className="w-4 h-4" />
          {wellnessScore === null ? "Start Your First Check-In" : "Start Today's Check-In"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Voca Voice™ — ElevenLabs AI wellness companion */}
      <VocaVoicePlayer
        firstName={firstName}
        wellnessScore={wellnessScore}
        riskLevel={riskLevel}
        streakDays={streakDays}
      />

      <div className="grid grid-cols-2 gap-3">
        <QuickActionCard icon={TrendingUp} label="My History"     sub="View past check-ins"   color="violet" onClick={() => navigate('/my/history')} />
        <QuickActionCard icon={Calendar}   label="Consultations"  sub="Book a session"         color="blue"   onClick={() => navigate('/my/consultations')} />
        <QuickActionCard icon={BookOpen}   label="Resources"      sub="Articles & tools"       color="green"  onClick={() => navigate('/my/resources')} />
        <QuickActionCard icon={Heart}      label="My Profile"     sub="Account & preferences"  color="amber"  onClick={() => navigate('/my/profile')} />
      </div>

      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-4 flex gap-3">
        <Star className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Wellness Tip</p>
          <p className="text-sm text-violet-800">
            Even 10 minutes of mindful breathing can significantly reduce cortisol levels. Try pausing for a few deep breaths before your next meeting.
          </p>
        </div>
      </div>

    </div>
  )
}

export default MyWellnessHome
