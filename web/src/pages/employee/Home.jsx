import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, ArrowRight, Calendar, CheckCircle2,
  Mic, Activity, Brain, Zap, Heart, Flame, BarChart3, BookOpen, AlertTriangle, Loader2
} from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useState } from 'react'

// Risk level → colour map
const RISK_COLOR = {
  green:  { dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-100'  },
  yellow: { dot: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-100'  },
  orange: { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-100' },
  red:    { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-100'    },
}

// Wellness level label
const LEVEL_LABEL = {
  thriving:  '🌟 Thriving',
  healthy:   '😊 Healthy',
  at_risk:   '⚠️ At Risk',
  in_crisis: '💙 Needs Support',
}

function Orb({ className, delay = 0 }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-15 pointer-events-none ${className}`}
      animate={{ y: [0, -28, 0], x: [0, 18, 0], scale: [1, 1.08, 1] }}
      transition={{ duration: 9 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  )
}

function TrendBadge({ trend }) {
  if (trend === 'improving') return (
    <span className="inline-flex items-center gap-1.5 text-green-700 bg-green-100 border border-green-200 rounded-full px-3 py-1 text-sm font-semibold">
      <TrendingUp className="w-4 h-4" /> Improving
    </span>
  )
  if (trend === 'stable') return (
    <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-3 py-1 text-sm font-semibold">
      <Minus className="w-4 h-4" /> Stable
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 text-orange-700 bg-orange-100 border border-orange-200 rounded-full px-3 py-1 text-sm font-semibold">
      <TrendingDown className="w-4 h-4" /> Check-in recommended
    </span>
  )
}

// Mini score ring for the hero card
function MiniRing({ score, riskLevel, size = 120 }) {
  const r = size / 2 - 10
  const circ = 2 * Math.PI * r
  const fill = Math.min(100, Math.max(0, score || 0))
  const offset = circ - (fill / 100) * circ
  const stroke = riskLevel === 'red' ? '#ef4444' : riskLevel === 'orange' ? '#f97316' : riskLevel === 'yellow' ? '#eab308' : '#22c55e'
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="9" />
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.4 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-extrabold text-white"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, ease: 'backOut', duration: 0.5 }}
        >
          {score ?? '--'}
        </motion.span>
        <span className="text-xs text-white/70 font-medium">/ 100</span>
      </div>
    </div>
  )
}

// Dimensional mini-bar for the hero card
function HeroDimBar({ label, value, icon: Icon, delay }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  const isRisk = label !== 'Engagement'
  const barColor = isRisk
    ? pct >= 65 ? 'bg-red-400' : pct >= 45 ? 'bg-amber-400' : 'bg-green-400'
    : pct >= 60 ? 'bg-green-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between text-xs text-white/90">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3 h-3 text-white/70" />}
          <span>{label}</span>
        </div>
        <span className="font-bold">{pct}</span>
      </div>
      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.1, duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } }
const item = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } }

export const MyWellnessHome = () => {
  const navigate   = useNavigate()
  const [sosSending, setSosSending] = useState(false)
  const [sosTriggered, setSosTriggered] = useState(false)

  const { data: wellnessResponse, isLoading } = useApi(['wellness', 'home'], () => api.get('/my/wellness'), { retry: 1, staleTime: 30_000 })
  const wellness = wellnessResponse?.data

  const handleSOS = async () => {
    if (sosTriggered) return
    setSosSending(true)
    try {
      await api.post('/my/sos', { message: '', contactMe: true })
      setSosTriggered(true)
      toast.success('🚨 Your support request has been sent. Your care team will reach out shortly.', { duration: 6000 })
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Could not send SOS. Please call your HR directly.'
      toast.error(msg, { duration: 8000 })
    } finally {
      setSosSending(false)
    }
  }

  if (isLoading) return <LoadingScreen />

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening'
  const dims = wellness?.latestDimensionalScores
  const riskLevel = wellness?.latestRiskLevel || 'green'
  const score = wellness?.wellnessScore

  return (
    <div className="relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <Orb className="w-80 h-80 bg-cittaa-400 top-0 right-0"     delay={0} />
        <Orb className="w-96 h-96 bg-blue-300 -bottom-20 -left-20" delay={2} />
        <Orb className="w-56 h-56 bg-purple-300 top-1/2 left-1/3"  delay={4} />
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="relative space-y-6">

        {/* Greeting */}
        <motion.div variants={item}>
          <h1 className="text-3xl font-bold text-app mb-1">{greeting}, {wellness?.firstName || 'there'}!</h1>
          <p className="text-gray-500">How are you feeling today?</p>
        </motion.div>

        {/* Hero wellness card */}
        <motion.div variants={item}>
          <div
            className="relative overflow-hidden rounded-2xl p-7 shadow-xl"
            style={{ background: 'linear-gradient(135deg, #7e22ce 0%, #6b21a8 40%, #1e40af 100%)' }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 bg-white pointer-events-none" />
            <div className="absolute -bottom-12 left-1/3 w-48 h-48 rounded-full blur-2xl opacity-10 bg-blue-200 pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              {/* Left side */}
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-sm font-medium mb-1">Your Wellness Score</p>
                <div className="mb-5">
                  <TrendBadge trend={wellness?.trend} />
                </div>

                {/* Dimensional breakdown inside hero */}
                {dims && (
                  <div className="space-y-2.5 mb-6 max-w-xs">
                    {dims.depression != null && <HeroDimBar label="Depression Risk" value={dims.depression} icon={Brain}     delay={0.5} />}
                    {dims.anxiety    != null && <HeroDimBar label="Anxiety Level"   value={dims.anxiety}    icon={Activity}  delay={0.6} />}
                    {dims.stress     != null && <HeroDimBar label="Stress Score"    value={dims.stress}     icon={Zap}       delay={0.7} />}
                    {dims.engagement != null && <HeroDimBar label="Engagement"      value={dims.engagement} icon={TrendingUp} delay={0.8} />}
                  </div>
                )}

                <Button
                  variant="primary" size="lg"
                  onClick={() => navigate('/my/check-in')}
                  className="!bg-white !text-cittaa-700 hover:!bg-gray-50 !border-0 font-semibold shadow-md inline-flex items-center gap-2"
                >
                  <Mic className="w-4 h-4" /> Begin Wellness Check-in <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Ring score */}
              {score != null && (
                <div className="flex-shrink-0">
                  <MiniRing score={score} riskLevel={riskLevel} size={140} />
                  {wellness?.latestWellnessLevel && (
                    <p className="text-center text-white/80 text-xs font-medium mt-2">
                      {LEVEL_LABEL[wellness.latestWellnessLevel] || wellness.latestWellnessLevel}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Streak', value: wellness?.streak ? `${wellness.streak}d` : '—', icon: Flame, color: 'text-orange-600', bg: 'bg-orange-100', desc: 'consecutive days' },
            { label: 'Check-ins', value: wellness?.recentSessions?.length ?? 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', desc: 'this week' },
            { label: 'Risk Level', value: riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1), icon: BarChart3, color: RISK_COLOR[riskLevel]?.text || 'text-gray-600', bg: RISK_COLOR[riskLevel]?.bg || 'bg-gray-100', desc: 'current status' },
            { label: 'Wellness', value: score != null ? score : '—', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-100', desc: 'latest score' },
          ].map(({ label, value, icon: Icon, color, bg, desc }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm card-hover-lift"
            >
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-extrabold text-app">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Check-ins */}
          <motion.div variants={item}>
            <Card className="p-6 card-hover-lift h-full">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cittaa-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-cittaa-700" />
                  </div>
                  <h3 className="font-semibold text-app">Recent Check-ins</h3>
                </div>
                <button onClick={() => navigate('/my/history')} className="text-xs text-cittaa-700 font-medium hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2">
                {wellness?.recentSessions?.length > 0 ? wellness.recentSessions.map((s, i) => {
                  const sc    = s.score
                  const lvl   = s.riskLevel || 'green'
                  const rc    = RISK_COLOR[lvl] || RISK_COLOR.green
                  const label = LEVEL_LABEL[s.wellnessLevel] || '—'
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${rc.dot}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-xs text-gray-500">{label}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-cittaa-700">
                          {sc != null ? sc : '—'}
                        </span>
                        <span className="text-xs text-gray-400"> / 100</span>
                      </div>
                    </motion.div>
                  )
                }) : (
                  <div className="py-8 text-center">
                    <div className="text-4xl mb-3">🎯</div>
                    <p className="text-sm text-gray-500">No check-ins yet — start your first one!</p>
                    <button onClick={() => navigate('/my/check-in')} className="mt-3 text-sm text-cittaa-700 font-semibold hover:underline flex items-center gap-1 mx-auto">
                      Begin now <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Quick actions */}
          <motion.div variants={item}>
            <Card className="p-6 card-hover-lift h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-app">Quick Actions</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Start Check-in', desc: 'Record & analyse your voice', icon: Mic, path: '/my/check-in', gradient: 'from-cittaa-600 to-purple-600' },
                  { label: 'View History', desc: 'All your past check-ins', icon: BarChart3, path: '/my/history', gradient: 'from-blue-600 to-cyan-600' },
                  { label: 'Resources', desc: 'Wellness tips & exercises', icon: BookOpen, path: '/my/resources', gradient: 'from-green-600 to-emerald-600' },
                  { label: 'Consultations', desc: 'Book or view sessions', icon: Calendar, path: '/my/consultations', gradient: 'from-orange-600 to-amber-600' },
                ].map(({ label, desc, icon: Icon, path, gradient }, i) => (
                  <motion.button
                    key={label}
                    onClick={() => navigate(path)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.07 }}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors text-left group"
                  >
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <Icon className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-app">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-cittaa-600 transition-colors flex-shrink-0" />
                  </motion.button>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Upcoming Consultations */}
        {wellness?.upcomingConsultations?.length > 0 && (
          <motion.div variants={item}>
            <Card className="p-6 card-hover-lift">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-app">Upcoming Consultations</h3>
                <button onClick={() => navigate('/my/consultations')} className="text-sm text-cittaa-700 font-medium hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {wellness.upcomingConsultations.map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 + 0.3 }}
                    className="p-4 bg-gradient-to-r from-blue-50 to-sky-50 rounded-xl border border-blue-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-app">{c.clinician || 'Clinician TBD'}</p>
                      <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full">Upcoming</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      {new Date(c.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                      at {new Date(c.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {c.meetLink && (
                      <button
                        onClick={() => window.open(c.meetLink, '_blank', 'noopener,noreferrer')}
                        className="flex items-center gap-2 w-full justify-center py-2 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #1a73e8, #1558b0)' }}
                      >
                        Join Video Session
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
        {/* Crisis SOS Strip */}
        <motion.div variants={item}>
          <div className={`rounded-2xl p-5 border-2 transition-all ${
            sosTriggered
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-200 hover:border-red-400'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sosTriggered ? 'bg-green-100' : 'bg-red-100'}`}>
                  <AlertTriangle className={`w-5 h-5 ${sosTriggered ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <p className={`font-bold text-sm ${sosTriggered ? 'text-green-800' : 'text-red-800'}`}>
                    {sosTriggered ? '✅ Support request sent' : 'Need immediate support?'}
                  </p>
                  <p className={`text-xs ${sosTriggered ? 'text-green-600' : 'text-red-500'}`}>
                    {sosTriggered
                      ? 'Your care team has been notified and will reach out shortly.'
                      : 'If you are in distress, press the SOS button — your psychologist will be notified immediately.'}
                  </p>
                </div>
              </div>
              {!sosTriggered && (
                <motion.button
                  onClick={handleSOS}
                  disabled={sosSending}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md disabled:opacity-70 transition-colors"
                >
                  {sosSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                  {sosSending ? 'Sending…' : 'SOS — I Need Help Now'}
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  )
}

export default MyWellnessHome
