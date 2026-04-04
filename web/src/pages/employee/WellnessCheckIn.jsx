import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, Mic, Sparkles, Target, TrendingUp, TrendingDown,
  Minus, Activity, Brain, Zap, Heart, Wind, BarChart3, RefreshCw,
  ArrowRight, ShieldCheck, AlertTriangle, Info
} from 'lucide-react'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { WaveformRecorder } from '../../components/audio/WaveformRecorder'
import { usePolling } from '../../hooks/usePolling'
import api from '../../services/api'
import toast from 'react-hot-toast'

const STEPS = ['Environment', 'Recording', 'Processing', 'Results']
const DAILY_MIN = 9
const DAILY_MAX = 12

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
  exit:   { opacity: 0, y: -20, transition: { duration: 0.3 } },
}

// Animated waveform bars shown while processing
function ProcessingWaveform() {
  return (
    <div className="flex items-center justify-center gap-1.5 h-16">
      {[...Array(9)].map((_, i) => (
        <motion.div
          key={i}
          className="w-2.5 rounded-full bg-cittaa-600"
          animate={{ scaleY: [0.2, 1, 0.2] }}
          transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut', delay: Math.abs(4 - i) * 0.09 }}
          style={{ height: 44, transformOrigin: 'bottom' }}
        />
      ))}
    </div>
  )
}

// Circular wellness score ring
function WellnessRing({ score, level, riskLevel }) {
  const radius = 72
  const circ   = 2 * Math.PI * radius
  const fill   = Math.min(100, Math.max(0, score || 0))
  const offset = circ - (fill / 100) * circ

  const ringColor =
    riskLevel === 'red'    ? '#ef4444' :
    riskLevel === 'orange' ? '#f97316' :
    riskLevel === 'yellow' ? '#eab308' :
    '#22c55e'

  const levelConfig = {
    thriving:  { label: '🌟 Thriving',      bg: 'from-emerald-50 to-green-50',    text: 'text-emerald-800',  border: 'border-emerald-200' },
    healthy:   { label: '😊 Healthy',        bg: 'from-green-50 to-teal-50',       text: 'text-green-800',    border: 'border-green-200'   },
    at_risk:   { label: '⚠️ At Risk',        bg: 'from-amber-50 to-yellow-50',     text: 'text-amber-800',    border: 'border-amber-200'   },
    in_crisis: { label: '💙 Needs Support',  bg: 'from-red-50 to-rose-50',         text: 'text-red-800',      border: 'border-red-200'     },
  }[level] || { label: '😊 Healthy', bg: 'from-green-50 to-teal-50', text: 'text-green-800', border: 'border-green-200' }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
          <circle cx="90" cy="90" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <motion.circle
            cx="90" cy="90" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.6, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-extrabold text-gray-900"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, ease: 'backOut', duration: 0.6 }}
          >
            {score ?? '--'}
          </motion.span>
          <span className="text-xs text-gray-500 font-medium">/ 100</span>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className={`px-4 py-2 rounded-full border bg-gradient-to-r ${levelConfig.bg} ${levelConfig.border}`}
      >
        <span className={`text-sm font-semibold ${levelConfig.text}`}>{levelConfig.label}</span>
      </motion.div>
    </div>
  )
}

// Dimensional score bar
function DimBar({ label, value, color, icon: Icon, delay = 0 }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  const isRisk = ['depression', 'anxiety', 'stress', 'burnout'].includes(label.toLowerCase())
  // For risk dims, high value = bad. For engagement, high = good.
  const barColor = isRisk
    ? pct >= 65 ? 'bg-red-500' : pct >= 45 ? 'bg-amber-500' : 'bg-green-500'
    : pct >= 60 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'

  const statusText = isRisk
    ? pct >= 65 ? 'Elevated' : pct >= 45 ? 'Moderate' : 'Normal'
    : pct >= 60 ? 'Good' : pct >= 40 ? 'Fair' : 'Low'

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          {Icon && <Icon className={`w-4 h-4 ${color}`} />}
          {label}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isRisk
              ? pct >= 65 ? 'bg-red-100 text-red-700' : pct >= 45 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              : pct >= 60 ? 'bg-green-100 text-green-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>{statusText}</span>
          <span className="font-bold text-gray-900 w-8 text-right">{pct}</span>
        </div>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
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

// Biomarker finding card
function BiomarkerCard({ label, finding, severity, icon: Icon, delay = 0 }) {
  const sev = severity || 'low'
  const cfg = {
    low:      { dot: 'bg-green-500',  bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  badge: 'Normal' },
    moderate: { dot: 'bg-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  badge: 'Mild'   },
    high:     { dot: 'bg-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    badge: 'Alert'  },
  }[sev] || { dot: 'bg-gray-400', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: '—' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${cfg.text} flex-shrink-0 mt-0.5`} />}
          <div>
            <p className={`text-xs font-bold ${cfg.text} uppercase tracking-wide`}>{label}</p>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{finding}</p>
          </div>
        </div>
        <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.badge}
        </span>
      </div>
    </motion.div>
  )
}

export const WellnessCheckIn = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [dailyProgress, setDailyProgress] = useState(null)
  const [sessionData, setSessionData] = useState(null)

  useEffect(() => {
    api.get('/sessions/daily-progress').then(r => setDailyProgress(r)).catch(() => {})
  }, [])

  const { data: pollData, completed, startPolling } = usePolling(
    () => api.get(`/sessions/${sessionId}`),
    (result) => {
      const status = result?.data?.session?.status || result?.session?.status
      return status === 'completed' || status === 'failed'
    },
    3000
  )

  // Start polling AFTER sessionId state is committed (avoids stale closure)
  useEffect(() => {
    if (sessionId) startPolling()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (completed && currentStep === 2) {
      const s = pollData?.data?.session || pollData?.session
      if (s?.status === 'failed') {
        setCurrentStep(4) // error state
      } else {
        setSessionData(s)
        setCurrentStep(3)
      }
    }
  }, [completed]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnvironmentCheck = () => {
    if (dailyProgress && !dailyProgress.canCheckIn) {
      toast.error(`You've reached the daily maximum of ${DAILY_MAX} check-ins. Great job today! 🎉`)
      return
    }
    setCurrentStep(1)
  }

  const handleRecordingComplete = async (blob) => {
    setCurrentStep(2)
    const formData = new FormData()
    // Include filename so multer receives proper Content-Type in the multipart part
    formData.append('audio', blob, 'recording.webm')
    formData.append('type', 'wellness-checkin')
    try {
      const response = await api.post('/sessions', formData)
      const newSessionId = response?.session?.id || response?.session?._id
      if (!newSessionId) throw new Error('No session ID returned')
      if (response?.dailyProgress) setDailyProgress(response.dailyProgress)
      setSessionId(newSessionId) // triggers useEffect → startPolling with correct ID
    } catch (error) {
      // Interceptor normalises to { success:false, error:{ message, code, status } }
      // Fall back through legacy shapes just in case
      console.error('[check-in] submission failed:', error)
      const msg = error?.error?.message
               || error?.message
               || 'Failed to process check-in. Please try again.'
      toast.error(msg)
      setCurrentStep(1)
    }
  }

  // Extract all result data
  const wellness   = sessionData?.employeeWellnessOutput || {}
  const vocare     = sessionData?.vocacoreResults || {}
  const dims       = vocare.dimensionalScores || {}
  const biomarkers = vocare.biomarkerFindings || {}
  const riskLevel  = vocare.overallRiskLevel || 'green'
  const confidence = vocare.confidence || null
  const algo       = vocare.algorithmVersion || vocare.engineVersion || null

  const bioIcon = { pitch: Activity, speech_rate: Wind, vocal_quality: Mic, energy_level: Zap, rhythm_stability: BarChart3 }
  const bioLabel = { pitch: 'Pitch Analysis', speech_rate: 'Speech Rate', vocal_quality: 'Vocal Quality', energy_level: 'Energy Level', rhythm_stability: 'Rhythm & Pauses' }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Daily progress bar */}
      {dailyProgress && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Today's Check-ins</span>
            <span className={`text-sm font-bold ${dailyProgress.metDailyGoal ? 'text-green-600' : 'text-cittaa-700'}`}>
              {dailyProgress.todayCount} / {DAILY_MAX}
              {dailyProgress.metDailyGoal && ' ✓ Goal met!'}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <motion.div
              className={`h-2.5 rounded-full ${dailyProgress.metDailyGoal ? 'bg-green-500' : 'bg-cittaa-700'}`}
              initial={{ width: 0 }}
              animate={{ width: `${(dailyProgress.todayCount / DAILY_MAX) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0</span>
            <span className="text-cittaa-600 font-medium">Goal: {DAILY_MIN}</span>
            <span>{DAILY_MAX}</span>
          </div>
        </motion.div>
      )}

      {/* Step progress */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center flex-1">
            <motion.div
              animate={{ backgroundColor: idx <= currentStep ? '#7e22ce' : '#e5e7eb', scale: idx === currentStep ? 1.1 : 1 }}
              transition={{ duration: 0.3 }}
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{ color: idx <= currentStep ? 'white' : '#6b7280' }}
            >
              {idx < currentStep ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
            </motion.div>
            <p className="text-sm ml-2 text-app font-medium hidden sm:block">{step}</p>
            {idx < STEPS.length - 1 && (
              <motion.div
                animate={{ backgroundColor: idx < currentStep ? '#7e22ce' : '#e5e7eb' }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex-1 h-1 mx-2 rounded-full"
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">

        {/* ── Step 1: Environment ──────────────────────────────────────────────── */}
        {currentStep === 0 && (
          <motion.div key="env" variants={pageVariants} initial="hidden" animate="show" exit="exit">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cittaa-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-cittaa-700" />
                </div>
                <h2 className="text-2xl font-bold text-app">Check Your Environment</h2>
              </div>
              <div className="space-y-3 mb-8">
                {[
                  "I'm in a quiet, private space",
                  "My microphone is working properly",
                  "I have at least 5 minutes to complete this check-in",
                  "I consent to my voice being recorded for analysis",
                ].map((label, i) => (
                  <motion.label
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-cittaa-600" />
                    <span className="text-app text-sm">{label}</span>
                  </motion.label>
                ))}
              </div>
              {dailyProgress && !dailyProgress.canCheckIn ? (
                <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-center">
                  <p className="text-green-800 font-semibold text-lg">🎉 All {DAILY_MAX} check-ins done for today!</p>
                  <p className="text-green-700 text-sm mt-1">Come back tomorrow to continue tracking your wellness.</p>
                </div>
              ) : (
                <Button variant="primary" size="lg" onClick={handleEnvironmentCheck} className="w-full">
                  Continue to Recording
                  {dailyProgress && <span className="ml-2 text-sm opacity-80">({dailyProgress.todayCount}/{DAILY_MAX} today)</span>}
                </Button>
              )}
            </Card>
          </motion.div>
        )}

        {/* ── Step 2: Recording ────────────────────────────────────────────────── */}
        {currentStep === 1 && (
          <motion.div key="rec" variants={pageVariants} initial="hidden" animate="show" exit="exit">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-4 justify-center">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-app">Wellness Check-in</h2>
              </div>
              <p className="text-gray-500 text-center mb-6">Please respond naturally. Take 2–5 minutes to share.</p>
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8 p-6 bg-gradient-to-br from-cittaa-50 to-blue-50 rounded-xl border border-cittaa-200"
              >
                <p className="text-cittaa-900 text-center font-medium leading-relaxed">
                  Please tell us how you've been feeling recently. What's going well, and what challenges are you facing?
                </p>
              </motion.div>
              <WaveformRecorder onRecordingComplete={handleRecordingComplete} minDuration={30} maxDuration={120} />
            </Card>
          </motion.div>
        )}

        {/* ── Step 3: Processing ───────────────────────────────────────────────── */}
        {currentStep === 2 && (
          <motion.div key="proc" variants={pageVariants} initial="hidden" animate="show" exit="exit">
            <Card className="p-12 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cittaa-100 mb-6"
              >
                <Sparkles className="w-8 h-8 text-cittaa-700" />
              </motion.div>
              <h2 className="text-2xl font-bold text-app mb-3">Analyzing Your Wellness</h2>
              <ProcessingWaveform />
              <p className="text-gray-500 mt-6 mb-1">Running voice analysis with VocoCore AI...</p>
              <p className="text-sm text-gray-400">Usually takes 30–60 seconds</p>
              <div className="mt-8 grid grid-cols-3 gap-3">
                {['Acoustic Features', 'ML Inference', 'Wellness Scoring'].map((label, i) => (
                  <motion.div
                    key={i}
                    className="p-2.5 bg-cittaa-50 rounded-lg border border-cittaa-100 text-xs text-cittaa-700 font-medium"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.7 }}
                  >
                    {label}
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Step 4: Results ──────────────────────────────────────────────────── */}
        {currentStep === 3 && (
          <motion.div key="results" variants={pageVariants} initial="hidden" animate="show" exit="exit" className="space-y-5">

            {/* Header */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-app">Your Wellness Report</h2>
              <p className="text-gray-500 text-sm mt-1">VocoCore AI voice analysis complete</p>
            </div>

            {/* Score ring + level */}
            <Card className="p-8">
              <div className="flex flex-col items-center gap-6">
                <WellnessRing
                  score={wellness.wellnessScore}
                  level={wellness.wellnessLevel}
                  riskLevel={riskLevel}
                />
                {/* Confidence + algo badge */}
                {(confidence || algo) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="flex flex-wrap justify-center gap-2"
                  >
                    {confidence && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> AI Confidence: {confidence}%
                      </span>
                    )}
                    {algo && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1">
                        <Brain className="w-3.5 h-3.5" /> {algo}
                      </span>
                    )}
                  </motion.div>
                )}
              </div>
            </Card>

            {/* Dimensional scores */}
            {(dims.depression != null || dims.anxiety != null) && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-app">Psychological Dimensions</h3>
                    <p className="text-xs text-gray-500">Risk scores — lower is better for mood indicators</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {dims.depression != null && <DimBar label="Depression Risk"  value={dims.depression} color="text-blue-600"   icon={Brain}      delay={0.1} />}
                  {dims.anxiety    != null && <DimBar label="Anxiety Level"    value={dims.anxiety}    color="text-amber-600"  icon={AlertTriangle} delay={0.2} />}
                  {dims.stress     != null && <DimBar label="Stress Score"     value={dims.stress}     color="text-orange-600" icon={Zap}         delay={0.3} />}
                  {dims.burnout    != null && <DimBar label="Burnout Index"    value={dims.burnout}    color="text-red-600"    icon={Heart}       delay={0.4} />}
                  {dims.engagement != null && <DimBar label="Engagement"       value={dims.engagement} color="text-green-600"  icon={TrendingUp}  delay={0.5} />}
                </div>
              </Card>
            )}

            {/* Voice biomarker findings */}
            {Object.keys(biomarkers).length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-app">Voice Biomarker Analysis</h3>
                    <p className="text-xs text-gray-500">Acoustic indicators calibrated for Indian voices</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {Object.entries(biomarkers).map(([key, val], i) => (
                    <BiomarkerCard
                      key={key}
                      label={bioLabel[key] || key}
                      finding={val.finding}
                      severity={val.severity}
                      icon={bioIcon[key] || Activity}
                      delay={0.1 + i * 0.07}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Recommendations */}
            {wellness.personalizedRecommendations?.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-app">Personalised Suggestions</h3>
                </div>
                <div className="space-y-2.5">
                  {wellness.personalizedRecommendations.map((rec, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex items-start gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100"
                    >
                      <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">✓</span>
                      <p className="text-sm text-green-900">{rec}</p>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}

            {/* Daily progress / goal */}
            {dailyProgress && !dailyProgress.metDailyGoal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="p-4 bg-cittaa-50 rounded-xl border border-cittaa-200 text-center"
              >
                <p className="text-cittaa-800 font-medium">
                  {dailyProgress.remaining} more check-in{dailyProgress.remaining !== 1 ? 's' : ''} to reach your daily goal of {DAILY_MIN} 💪
                </p>
              </motion.div>
            )}
            {dailyProgress?.metDailyGoal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="p-4 bg-green-50 rounded-xl border border-green-200 text-center">
                <p className="text-green-800 font-medium">🎉 Daily goal of {DAILY_MIN} check-ins reached!</p>
              </motion.div>
            )}

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Button variant="primary" onClick={() => navigate('/my')} className="flex-1 inline-flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4" /> Back to Home
              </Button>
              {dailyProgress?.canCheckIn && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCurrentStep(0); setSessionId(null); setSessionData(null)
                    api.get('/sessions/daily-progress').then(r => setDailyProgress(r)).catch(() => {})
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Another Check-in
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ── Step 5: Analysis Failed ───────────────────────────────────────── */}
        {currentStep === 4 && (
          <motion.div key="failed" variants={pageVariants} initial="hidden" animate="show" exit="exit">
            <Card className="p-12 text-center">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-6"
              >
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </motion.div>
              <h2 className="text-2xl font-bold text-app mb-3">Analysis Couldn't Complete</h2>
              <p className="text-gray-500 mb-2 max-w-md mx-auto">
                Our AI couldn't process this recording — this can happen if the audio was too short, very noisy,
                or the microphone cut out unexpectedly.
              </p>
              <p className="text-gray-400 text-sm mb-8">Your data was not saved. You can try again right away.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => { setCurrentStep(1); setSessionId(null) }}
                  className="bg-cittaa-700 hover:bg-cittaa-800 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 justify-center"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(0)}
                  className="border-gray-200 text-gray-600 hover:bg-gray-50 px-6 py-2.5 rounded-xl"
                >
                  Back to Start
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-6">
                Tips: speak clearly for at least 30 seconds, reduce background noise, and stay close to your microphone.
              </p>
            </Card>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

export default WellnessCheckIn
