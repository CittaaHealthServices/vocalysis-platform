import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Card, CardTitle, Button, Input, Select, Modal, Spinner } from '../../components/ui'
import { WaveformRecorder } from '../../components/audio/WaveformRecorder'
import { usePolling } from '../../hooks/usePolling'
import api from '../../services/api'
import toast from 'react-hot-toast'

const STEPS = ['Patient', 'Setup', 'Recording', 'Processing', 'Results']

export const NewAssessment = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [patientId, setPatientId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [recordedAudio, setRecordedAudio] = useState(null)

  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      language: 'English',
      promptSet: 'A',
      presentingComplaints: '',
      phq9Score: '',
      gad7Score: '',
    },
  })

  const { isPolling, data: processingData, progress, completed, startPolling } = usePolling(
    () => api.get(`/sessions/${sessionId}`),
    (result) => result?.session?.status === 'completed' || result?.session?.status === 'failed',
    3000
  )

  // Advance to Results step when polling finishes
  useEffect(() => {
    if (completed && currentStep === 3) setCurrentStep(4)
  }, [completed])

  const handlePatientSelect = (id) => {
    setPatientId(id)
    setCurrentStep(1)
  }

  const handleSetupSubmit = (data) => {
    setCurrentStep(2)
  }

  const handleRecordingComplete = async (blob) => {
    setRecordedAudio(blob)
    setCurrentStep(3)

    const formData = new FormData()
    formData.append('audio', blob)
    formData.append('patientId', patientId)
    formData.append('language', watch('language'))
    formData.append('promptSet', watch('promptSet'))
    formData.append('presentingComplaints', watch('presentingComplaints'))
    formData.append('phq9Score', watch('phq9Score') || null)
    formData.append('gad7Score', watch('gad7Score') || null)

    try {
      const response = await api.post('/sessions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setSessionId(response.data.id)
      startPolling()
    } catch (error) {
      toast.error('Failed to create session')
      setCurrentStep(2)
    }
  }

  const handleResultsView = () => {
    navigate(`/clinical/session/${sessionId}`)
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
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
      </div>

      {/* Step 1: Patient Selection */}
      {currentStep === 0 && (
        <Card className="p-8">
          <CardTitle className="mb-6">Select or Add Patient</CardTitle>
          <div className="space-y-4">
            <Input
              label="Search Patient"
              placeholder="Enter name or ID..."
              onChange={(e) => {
                if (e.target.value.length > 2) {
                  // Fetch patients
                }
              }}
            />
            <Button
              variant="primary"
              onClick={() => handlePatientSelect('new')}
              className="w-full"
            >
              + Create New Patient
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Setup */}
      {currentStep === 1 && (
        <Card className="p-8">
          <CardTitle className="mb-6">Session Setup</CardTitle>
          <form onSubmit={handleSubmit(handleSetupSubmit)} className="space-y-4">
            <Select
              label="Language"
              options={[
                { value: 'English', label: 'English' },
                { value: 'Hindi', label: 'Hindi' },
                { value: 'Telugu', label: 'Telugu' },
                { value: 'Tamil', label: 'Tamil' },
                { value: 'Kannada', label: 'Kannada' },
              ]}
              {...register('language')}
            />
            <Select
              label="Prompt Set"
              options={[
                { value: 'A', label: 'Set A - General Well-being' },
                { value: 'B', label: 'Set B - Work-related Stress' },
                { value: 'C', label: 'Set C - Sleep & Recovery' },
              ]}
              {...register('promptSet')}
            />
            <div>
              <label className="block text-sm font-medium text-app mb-2">
                Presenting Complaints
              </label>
              <textarea
                className="input-base w-full resize-none"
                rows={4}
                placeholder="Brief description of patient's presenting concerns..."
                {...register('presentingComplaints')}
              />
            </div>
            <Input
              label="PHQ-9 Manual Score (if available)"
              type="number"
              min={0}
              max={27}
              {...register('phq9Score')}
            />
            <Input
              label="GAD-7 Manual Score (if available)"
              type="number"
              min={0}
              max={21}
              {...register('gad7Score')}
            />
            <div className="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCurrentStep(0)}
              >
                Back
              </Button>
              <Button type="submit" variant="primary">
                Continue to Recording
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Step 3: Recording */}
      {currentStep === 2 && (
        <Card className="p-8">
          <CardTitle className="mb-6">Record Assessment Audio</CardTitle>
          <p className="text-gray-600 mb-6 text-center">
            Follow the prompt below and speak naturally for 1-8 minutes
          </p>
          <div className="mb-8 p-6 bg-cittaa-50 rounded-lg border border-cittaa-200">
            <p className="text-cittaa-900 text-center font-medium">
              Please describe your current state of mind, how you've been feeling lately, and any concerns you might have.
            </p>
          </div>
          <WaveformRecorder
            onRecordingComplete={handleRecordingComplete}
            minDuration={60}
            maxDuration={480}
          />
        </Card>
      )}

      {/* Step 4: Processing */}
      {currentStep === 3 && !completed && (
        <Card className="p-12 text-center">
          <CardTitle className="mb-8">Processing Assessment</CardTitle>
          <Spinner size="lg" className="mx-auto mb-6" />
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-left">
              <div className={`w-3 h-3 rounded-full ${progress > 20 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Analyzing acoustic features...</span>
            </div>
            <div className="flex items-center gap-3 text-left">
              <div className={`w-3 h-3 rounded-full ${progress > 60 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Running VocaCore™ Engine...</span>
            </div>
            <div className="flex items-center gap-3 text-left">
              <div className={`w-3 h-3 rounded-full ${progress > 85 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">Generating insights...</span>
            </div>
          </div>
          <div className="mt-8 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-cittaa-700 h-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 95)}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Usually takes 60-90 seconds
          </p>
        </Card>
      )}

      {/* Step 5: Results */}
      {currentStep === 4 && (
        <Card className="p-12 text-center">
          <CardTitle className="mb-6">Assessment Complete!</CardTitle>
          <p className="text-gray-600 mb-8">
            Your assessment has been processed successfully
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={handleResultsView}
          >
            View Full Results
          </Button>
        </Card>
      )}
    </div>
  )
}

export default NewAssessment
