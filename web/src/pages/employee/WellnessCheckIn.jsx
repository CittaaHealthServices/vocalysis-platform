import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Mic, Loader2, Sparkles, Target } from 'lucide-react'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { WaveformRecorder } from '../../components/audio/WaveformRecorder'
import { usePolling } from '../../hooks/usePolling'
import { WellnessWheel } from '../../components/charts/WellnessWheel'
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
          className="w-2 rounded-full bg-cittaa-600"
          animate={{ scaleY: [0.25, 1, 0.25] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: Math.abs(4 - i) * 0.08,
          }}
          style={{ height: 40, transformOrigin: 'bottom' }}
        />
      ))}
    </div>
  )
}

export const WellnessCheckIn = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [dailyProgress, setDailyProgress] = useState(null)
  const [sessionData, setSessionData] = useState(null)

  useEffect(() => {
    api.get('/sessions/daily-progress')
      .then(r => setDailyProgress(r))
      .catch(() => {})
  }, [])

  const { isPolling, data: pollData, completed, startPolling } = usePolling(
    () => api.get(`/sessions/${sessionId}`),
    (result) => {
      const status = result?.data?.session?.status || result?.session?.status
      return status === 'completed' || status === 'failed'
    },
    3000
  )

  // Start polling only AFTER sessionId is committed to state (avoids stale closure)
  useEffect(() => {
    if (sessionId) {
      startPolling()
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (completed && currentStep === 2) {
      const s = pollData?.data?.session || pollData?.session
      setSessionData(s)
      setCurrentStep(3)
    }
  }, [completed])

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
    formData.append('audio', blob)
    formData.append('type', 'wellness-checkin')
    try {
      const response = await api.post('/sessions', formData)
      const newSessionId = response?.session?.id || response?.session?._id
      if (!newSessionId) throw new Error('No session ID returned')
      if (response?.dailyProgress) setDailyProgress(response.dailyProgress)
      setSessionId(newSessionId) // triggers useEffect → startPolling with correct ID
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to process check-in'
      toast.error(msg)
      setCurrentStep(1)
    }
  }

  const wellness  = sessionData?.employeeWellnessOutput || {}
  const riskLevel = sessionData?.vocacoreResults?.overallRiskLevel || 'green'
  const riskConfig = {
    green:  { bg: 'from-green-50 to-emerald-50',  border: 'border-green-200',  text: 'text-green-900'  },
    yellow: { bg: 'from-yellow-50 to-amber-50',   border: 'border-yellow-200', text: 'text-yellow-900' },
    orange: { bg: 'from-orange-50 to-amber-50',   border: 'border-orange-200', text: 'text-orange-900' },
    red:    { bg: 'from-red-50 to-rose-50',       border: 'border-red-200',    text: 'text-red-900'    },
  }[riskLevel] || { bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-green-900' }

  const wellnessLevelLabel = {
    thriving:  '🌟 Thriving',
    healthy:   '😊 Healthy',
    at_risk:   '⚠️ At Risk',
    in_crisis: '💙 Needs Support',
  }[wellness.wellnessLevel] || '😊 Healthy'

  const dimScores = sessionData?.vocacoreResults?.dimensionalScores || {}
  const wheelData = [
    { label: 'Mood',        value: Math.round(100 - (dimScores.depression || 0)) },
    { label: 'Calm',        value: Math.round(100 - (dimScores.anxiety    || 0)) },
    { label: 'Energy',      value: Math.round(100 - (dimScores.stress     || 0)) },
    { label: 'Engagement',  value: Math.round(dimScores.engagement || 60) },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
              animate={{
                backgroundColor: idx <= currentStep ? '#7e22ce' : '#e5e7eb',
                scale: idx === currentStep ? 1.1 : 1,
              }}
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
        {/* Step 1: Environment Check */}
        {currentStep === 0 && (
          <motion.div key="step-env" variants={pageVariants} initial="hidden" animate="show" exit="exit">
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
                  <p className="text-green-800 font-semibold text-lg">🎉 You've completed all {DAILY_MAX} check-ins for today!</p>
                  <p className="text-green-700 text-sm mt-1">Come back tomorrow to continue tracking your wellness.</p>
                </div>
              ) : (
                <Button variant="primary" size="lg" onClick={handleEnvironmentCheck} className="w-full">
                  Continue to Recording
                  {dailyProgress && (
                    <span className="ml-2 text-sm opacity-80">
                      ({dailyProgress.todayCount}/{DAILY_MAX} today)
                    </span>
                  )}
                </Button>
              )}
            </Card>
          </motion.div>
        )}

        {/* Step 2: Recording */}
        {currentStep === 1 && (
          <motion.div key="step-rec" variants={pageVariants} initial="hidden" animate="show" exit="exit">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-4 justify-center">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-app text-center">Wellness Check-in</h2>
              </div>
              <p className="text-gray-500 text-center mb-6">
                Please respond naturally to the prompt below. Take 2–5 minutes to share.
              </p>
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8 p-6 bg-gradient-to-br from-cittaa-50 to-blue-50 rounded-xl border border-cittaa-200"
              >
                <p className="text-cittaa-900 text-center font-medium leading-relaxed">
                  Please tell us how you've been feeling recently.
                  What's going well, and what challenges are you facing?
                </p>
              </motion.div>
              <WaveformRecorder
                onRecordingComplete={handleRecordingComplete}
                minDuration={30}
                maxDuration={120}
              />
            </Card>
          </motion.div>
        )}

        {/* Step 3: Processing */}
        {currentStep === 2 && !completed && (
          <motion.div key="step-proc" variants={pageVariants} initial="hidden" animate="show" exit="exit">
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
              <p className="text-gray-500 mt-6 mb-2">Running voice analysis with VocoCore AI...</p>
              <p className="text-sm text-gray-400">Usually takes 30–60 seconds</p>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Results */}
        {currentStep === 3 && (
          <motion.div key="step-results" variants={pageVariants} initial="hidden" animate="show" exit="exit">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6 justify-center">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-app text-center">Your Wellness Results</h2>
              </div>

              {/* Overall wellness level */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className={`rounded-xl border p-5 mb-6 text-center bg-gradient-to-r ${riskConfig.bg} ${riskConfig.border}`}
              >
                <p className={`text-2xl font-bold mb-1 ${riskConfig.text}`}>{wellnessLevelLabel}</p>
                {wellness.wellnessScore != null && (
                  <p className={`text-sm ${riskConfig.text} opacity-80`}>
                    Wellness Score: <strong className="text-lg">{wellness.wellnessScore}</strong> / 100
                  </p>
                )}
              </motion.div>

              {/* Dimensional wheel */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <WellnessWheel data={wheelData} />
              </motion.div>

              {/* Recommendations */}
              {wellness.personalizedRecommendations?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8 space-y-3"
                >
                  <h3 className="text-lg font-semibold text-app flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cittaa-600" />
                    Wellness Suggestions
                  </h3>
                  <ul className="space-y-2">
                    {wellness.personalizedRecommendations.map((r, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + idx * 0.1 }}
                        className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl text-green-900 border border-green-100 text-sm flex items-start gap-2"
                      >
                        <span className="text-green-500 mt-0.5">✓</span>
                        {r}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Daily progress reminder */}
              {dailyProgress && !dailyProgress.metDailyGoal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="mt-6 p-4 bg-cittaa-50 rounded-xl border border-cittaa-200 text-center"
                >
                  <p className="text-cittaa-800 font-medium">
                    {dailyProgress.remaining} more check-in{dailyProgress.remaining !== 1 ? 's' : ''} to reach your daily goal of {DAILY_MIN} 💪
                  </p>
                </motion.div>
              )}

              {dailyProgress?.metDailyGoal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="mt-6 p-4 bg-green-50 rounded-xl border border-green-200 text-center"
                >
                  <p className="text-green-800 font-medium">🎉 Daily goal of {DAILY_MIN} check-ins reached!</p>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-3 mt-8"
              >
                <Button variant="primary" onClick={() => navigate('/my')} className="flex-1">
                  Back to Home
                </Button>
                {dailyProgress?.canCheckIn && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCurrentStep(0)
                      setSessionId(null)
                      setSessionData(null)
                      api.get('/sessions/daily-progress').then(r => setDailyProgress(r)).catch(() => {})
                    }}
                    className="flex-1"
                  >
                    Another Check-in
                  </Button>
                )}
                <Button variant="secondary" onClick={() => navigate('/my/resources')} className="flex-1">
                  Explore Resources
                </Button>
              </motion.div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default WellnessCheckIn
