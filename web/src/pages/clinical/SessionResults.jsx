import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, Badge, Button, Tabs, LoadingScreen, Modal } from '../../components/ui'
import { ScoreGauge } from '../../components/charts/ScoreGauge'
import { TrendLine } from '../../components/charts/TrendLine'
import { useForm } from 'react-hook-form'
import api from '../../services/api'
import toast from 'react-hot-toast'
import ConsultationBookingModal from '../../components/consultations/ConsultationBookingModal'

export const SessionResults = () => {
  const { id } = useParams()
  const [consultationModalOpen, setConsultationModalOpen] = useState(false)
  const [editNotesModal, setEditNotesModal] = useState(false)

  const { data: session, isLoading } = useApi(
    ['session', id],
    () => api.get(`/sessions/${id}`)
  )

  const { register, handleSubmit } = useForm({
    defaultValues: {
      clinicianNotes: session?.clinicianNotes || '',
      phq9Actual: session?.phq9Actual || '',
      gad7Actual: session?.gad7Actual || '',
      observedIndicators: session?.observedIndicators || [],
      referralRecommended: session?.referralRecommended || false,
      priorityFlag: session?.priorityFlag || false,
    },
  })

  if (isLoading) return <LoadingScreen />

  const tabs = [
    {
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {/* Score Gauges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex justify-center">
              <ScoreGauge
                score={session?.depression || 0}
                label="Depression"
                size="md"
              />
            </div>
            <div className="flex justify-center">
              <ScoreGauge
                score={session?.anxiety || 0}
                label="Anxiety"
                size="md"
              />
            </div>
            <div className="flex justify-center">
              <ScoreGauge
                score={session?.stress || 0}
                label="Stress"
                size="md"
              />
            </div>
            <div className="flex justify-center">
              <ScoreGauge
                score={session?.emotionalStability || 0}
                label="Emotional Stability"
                size="md"
              />
            </div>
          </div>

          {/* Risk Level */}
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Risk Assessment</CardTitle>
              <Badge variant={session?.riskLevel || 'success'} size="lg">
                {session?.riskLevel?.toUpperCase() || 'LOW'}
              </Badge>
            </div>
            <p className="text-gray-600 mt-4">
              VocaCore™ Confidence: {session?.confidence || 0}%
            </p>
          </Card>
        </div>
      ),
    },
    {
      label: 'Biomarkers',
      content: (
        <div className="space-y-4">
          {[
            { name: 'Pitch Analysis', finding: 'Lower pitch variability indicates reduced emotional expressiveness', severity: 'moderate' },
            { name: 'Speech Dynamics', finding: 'Slower speech rate suggests cognitive processing difficulties', severity: 'mild' },
            { name: 'Vocal Quality', finding: 'Increased voice strain detected', severity: 'moderate' },
            { name: 'Energy Profile', finding: 'Below baseline energy indicators', severity: 'mild' },
            { name: 'Rhythmic Pattern', finding: 'Irregular speech rhythm observed', severity: 'mild' },
          ].map((biomarker) => (
            <Card key={biomarker.name} className="border-l-4 border-cittaa-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-app">{biomarker.name}</h4>
                  <p className="text-sm text-gray-600 mt-2">{biomarker.finding}</p>
                </div>
                <Badge variant={biomarker.severity} className="ml-4">
                  {biomarker.severity}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ),
    },
    {
      label: 'Trends',
      content: <TrendLine
        data={session?.trends || []}
        title="Score Trend Over 6 Sessions"
        hasReference={true}
      />,
    },
    {
      label: 'Clinical Notes',
      content: (
        <form onSubmit={handleSubmit(async (data) => {
          try {
            await api.put(`/sessions/${id}`, data)
            toast.success('Notes saved')
            setEditNotesModal(false)
          } catch (error) {
            toast.error('Failed to save notes')
          }
        })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app mb-2">Clinician Notes</label>
            <textarea
              className="input-base w-full resize-none"
              rows={4}
              {...register('clinicianNotes')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="PHQ-9 Score"
              min={0}
              max={27}
              {...register('phq9Actual')}
              className="input-base"
            />
            <input
              type="number"
              placeholder="GAD-7 Score"
              min={0}
              max={21}
              {...register('gad7Actual')}
              className="input-base"
            />
          </div>
          <Button type="submit" variant="primary">Save Notes</Button>
        </form>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-app">Assessment Results</h1>
          <p className="text-gray-600">Patient: {session?.patientName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Generate PDF Report</Button>
        </div>
      </div>

      <Tabs tabs={tabs} />

      {/* Action Buttons */}
      <div className="flex gap-4 flex-wrap">
        <Button
          variant="primary"
          onClick={() => setConsultationModalOpen(true)}
        >
          Book Consultation
        </Button>
        <Button
          variant="secondary"
          onClick={() => setEditNotesModal(true)}
        >
          Edit Clinical Notes
        </Button>
        <Button variant="secondary">
          Schedule Follow-up
        </Button>
      </div>

      <ConsultationBookingModal
        isOpen={consultationModalOpen}
        onClose={() => setConsultationModalOpen(false)}
        patientId={session?.patientId}
      />
    </div>
  )
}

export default SessionResults
