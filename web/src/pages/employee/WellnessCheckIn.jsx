import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { WaveformRecorder } from '../../components/audio/WaveformRecorder'
import { usePolling } from '../../hooks/usePolling'
import { WellnessWheel } from '../../components/charts/WellnessWheel'
import api from '../../services/api'
import toast from 'react-hot-toast'

const STEPS = ['Environment', 'Recording', 'Processing', 'Results']

export const WellnessCheckIn = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionId, setSessionId] = useState(null)

  const { isPolling, data: results, progress, completed, startPolling } = usePolling(
    () => api.get(`/sessions/${sessionId}`),
    (result) => result?.status === 'completed' || result?.status === 'failed',
    3000
  )

  const handleEnvironmentCheck = () => {
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
      setSessionId(response.data.id)
      startPolling()
    } catch (error) {
      toast.error('Failed to process check-in')
      setCurrentStep(1)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress */}
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
          <Button
            variant="primary"
            size="lg"
            onClick={handleEnvironmentCheck}
            className="w-full"
          >
            Continue to Recording
          </Button>
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
      {completed && currentStep === 2 && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-app mb-6 text-center">Your Wellness Results</h2>
          <WellnessWheel data={results?.wheelData || []} />
          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold text-app">Wellness Suggestions</h3>
            <ul className="space-y-2">
              {results?.suggestions?.map((suggestion, idx) => (
                <li key={idx} className="p-3 bg-green-50 rounded-lg text-green-900">
                  ✓ {suggestion}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-4 mt-8">
            <Button
              variant="primary"
              onClick={() => navigate('/my')}
              className="flex-1"
            >
              Back to Home
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/my/resources')}
              className="flex-1"
            >
              Explore Resources
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export default WellnessCheckIn
