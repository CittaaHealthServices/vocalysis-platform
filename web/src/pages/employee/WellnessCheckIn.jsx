import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { WaveformRecorder } from '../../components/audio/WaveformRecorder'
import { usePolling } from '../../hooks/usePolling'
import { WellnessWheel } from '../../components/charts/WellnessWheel'
import api from '../../services/api'
import toast from 'react-hot-toast'

const STEPS = ['Environment', 'Recording', 'Processing', 'Results']
const DAILY_MIN = 9
const DAILY_MAX = 12

export const WellnessCheckIn = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [dailyProgress, setDailyProgress] = useState(null)
  const [sessionData, setSessionData] = useState(null)

  // Fetch today's check-in count on mount
  useEffect(() => {
    api.get('/sessions/daily-progress')
      .then(r => setDailyProgress(r.data))
      .catch(() => {}) // non-critical
  }, [])

  // Poll the session status after submitting
  const { isPolling, data: pollData, completed, startPolling } = usePolling(
    () => api.get(`/sessions/${sessionId}`),
    // ✅ Fix: API returns { session: { status } } not { status }
    (result) => {
      const status = result?.data?.session?.status || result?.session?.status
      return status === 'completed' || status === 'failed'
    },
    3000
  )

  // Advance to Results step when polling finishes
  useEffect(() => {
    if (completed && currentStep === 2) {
      // ✅ Fix: extract session from nested response
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
      const response = await api.post('/sessions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // ✅ Fix: response.data.session.id (not response.data.id)
      const newSessionId = response.data?.session?.id || response.data?.session?._id
      if (!newSessionId) throw new Error('No session ID returned')

      setSessionId(newSessionId)

      // Update daily progress
      if (response.data?.dailyProgress) {
        setDailyProgress(response.data.dailyProgress)
      }

      startPolling()
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to process check-in'
      toast.error(msg)
      setCurrentStep(1)
    }
  }

  // ✅ Fix: pull wellness data from correct model fields
  const wellness = sessionData?.employeeWellnessOutput || {}
  const riskLevel = sessionData?.vocacoreResults?.overallRiskLevel || 'green'

  const riskColor = {
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  }[riskLevel] || 'bg-green-50 border-green-200 text-green-900'

  const wellnessLevelLabel = {
    thriving: '😊 Thriving',
    healthy: '🙂 Healthy',
    at_risk: '😐 At Risk',
    in_crisis: '😟 Needs Support',
  }[wellness.wellnessLevel] || '🙂 Healthy'

  // Build wheel data from dimensional scores
  const dimScores = sessionData?.vocacoreResults?.dimensionalScores || {}
  const wheelData = [
    { label: 'Mood',       value: Math.round(100 - (dimScores.depression || 0)) },
    { label: 'Calm',       value: Math.round(100 - (dimScores.anxiety    || 0)) },
    { label: 'Energy',     value: Math.round(100 - (dimScores.stress     || 0)) },
    { label: 'Engagement', value: Math.round(dimScores.engagement        || 60) },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Daily check-in progress bar */}
      {dailyProgress && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Today's Check-ins</span>
            <span className={`text-sm font-bold ${dailyProgress.metDailyGoal ? 'text-green-600' : 'text-cittaa-700'}`}>
              {dailyProgress.todayCount} / {DAILY_MAX}
              {dailyProgress.metDailyGoal && ' ✓ Goal met!'}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all ${dailyProgress.metDailyGoal ? 'bg-green-500' : 'bg-cittaa-700'}`}
              style={{ width: `${(dailyProgress.todayCount / DAILY_MAX) * 100}%` }}
            />
          </div>
          {/* Goal marker at 9 */}
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0</span>
            <span className="text-cittaa-600 font-medium">Goal: {DAILY_MIN}</span>
            <span>{DAILY_MAX}</span>
          </div>
        </div>
      )}

      {/* Step progress */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                idx <= currentStep
                  ? 'bg-cittaa-700 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {idx + 1}
            </div>
            <p className="text-sm ml-2 text-app font-medium">{step}</p>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  idx < currentStep ? 'bg-cittaa-700' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Environment Check */}
      {currentStep === 0 && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-app mb-6">Check Your Environment</h2>
          <div className="space-y-4 mb-8">
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-app">I'm in a quiet, private space</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-app">My microphone is working properly</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-app">I have at least 5 minutes to complete this check-in</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-app">I consent to my voice being recorded for analysis</span>
            </label>
          </div>

          {dailyProgress && !dailyProgress.canCheckIn ? (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
              <p className="text-green-800 font-semibold text-lg">🎉 You've completed all {DAILY_MAX} check-ins for today!</p>
              <p className="text-green-700 text-sm mt-1">Come back tomorrow to continue tracking your wellness.</p>
            </div>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={handleEnvironmentCheck}
              className="w-full"
            >
              Continue to Recording
              {dailyProgress && (
                <span className="ml-2 text-sm opacity-80">
                  ({dailyProgress.todayCount}/{DAILY_MAX} today)
                </span>
              )}
            </Button>
          )}
        </Card>
      )}

      {/* Step 2: Recording */}
      {currentStep === 1 && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-app mb-4 text-center">Wellness Check-in</h2>
          <p className="text-gray-600 text-center mb-6">
            Please respond naturally to the prompt below. Take 2-5 minutes to share.
          </p>
          <div className="mb-8 p-6 bg-cittaa-50 rounded-lg border border-cittaa-200">
            <p className="text-cittaa-900 text-center font-medium">
              Please tell us how you've been feeling recently. What's going well, and what challenges are you facing?
            </p>
          </div>
          <WaveformRecorder onRecordingComplete={handleRecordingComplete} minDuration={30} maxDuration={120} />
        </Card>
      )}

      {/* Step 3: Processing */}
      {currentStep === 2 && !completed && (
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold text-app mb-8">Analyzing Your Wellness</h2>
          <div className="inline-block w-12 h-12 border-4 border-cittaa-200 border-t-cittaa-700 rounded-full animate-spin mb-6" />
          <p className="text-gray-600 mb-4">Processing your voice analysis...</p>
          <p className="text-sm text-gray-500">Usually takes 30-60 seconds</p>
        </Card>
      )}

      {/* Step 4: Results */}
      {currentStep === 3 && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-app mb-2 text-center">Your Wellness Results</h2>

          {/* Overall wellness level */}
          <div className={`rounded-xl border p-4 mb-6 text-center ${riskColor}`}>
            <p className="text-2xl font-bold mb-1">{wellnessLevelLabel}</p>
            {wellness.wellnessScore != null && (
              <p className="text-sm">Wellness Score: <strong>{wellness.wellnessScore}</strong> / 100</p>
            )}
          </div>

          {/* Dimensional wheel */}
          <WellnessWheel data={wheelData} />

          {/* Recommendations */}
          {wellness.personalizedRecommendations?.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold text-app">Wellness Suggestions</h3>
              <ul className="space-y-2">
                {wellness.personalizedRecommendations.map((r, idx) => (
                  <li key={idx} className="p-3 bg-green-50 rounded-lg text-green-900">✓ {r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Daily progress reminder */}
          {dailyProgress && !dailyProgress.metDailyGoal && (
            <div className="mt-6 p-4 bg-cittaa-50 rounded-lg border border-cittaa-200 text-center">
              <p className="text-cittaa-800 font-medium">
                {dailyProgress.remaining} more check-in{dailyProgress.remaining !== 1 ? 's' : ''} to reach your daily goal of {DAILY_MIN} 💪
              </p>
            </div>
          )}
          {dailyProgress?.metDailyGoal && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200 text-center">
              <p className="text-green-800 font-medium">🎉 Daily goal of {DAILY_MIN} check-ins reached!</p>
            </div>
          )}

          <div className="flex gap-4 mt-8">
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
                  api.get('/sessions/daily-progress').then(r => setDailyProgress(r.data)).catch(() => {})
                }}
                className="flex-1"
              >
                Another Check-in
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/my/resources')} className="flex-1">
              Explore Resources
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export default WellnessCheckIn
