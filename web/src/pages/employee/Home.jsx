import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { ScoreGauge } from '../../components/charts/ScoreGauge'
import { TrendLine } from '../../components/charts/TrendLine'
import api from '../../services/api'

export const MyWellnessHome = () => {
  const navigate = useNavigate()
  const { data: wellness, isLoading } = useApi(['wellness', 'home'], () => api.get('/my/wellness'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-app mb-2">
          Good morning, {wellness?.firstName}!
        </h1>
        <p className="text-gray-600">How are you feeling today?</p>
      </div>

      {/* Wellness Score Card */}
      <Card className="p-8 bg-gradient-to-br from-cittaa-50 to-blue-50 border-0">
        <div className="flex flex-col lg:flex-row items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-app mb-2">Your Wellness Score</h2>
            <p className="text-gray-600 mb-4">
              {wellness?.trend === 'improving'
                ? '↑ Improving since last check-in'
                : wellness?.trend === 'stable'
                  ? '→ Stable'
                  : '↓ Declining'}
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/my/check-in')}
            >
              Begin Wellness Check-in
            </Button>
          </div>
          <div className="mt-8 lg:mt-0">
            <ScoreGauge score={wellness?.wellnessScore || 50} label="Overall" size="lg" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Assessment */}
        {wellness?.nextAssessment && (
          <Card className="p-6">
            <h3 className="font-semibold text-app mb-2">Next Assessment</h3>
            <p className="text-sm text-gray-600">
              Scheduled for {new Date(wellness.nextAssessment).toLocaleDateString()}
            </p>
            <Button variant="secondary" className="mt-4 w-full" size="sm">
              Reschedule
            </Button>
          </Card>
        )}

        {/* Recent Check-ins */}
        <Card className="p-6">
          <h3 className="font-semibold text-app mb-4">Recent Check-ins</h3>
          <div className="space-y-2">
            {wellness?.recentCheckins?.map((checkin, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {new Date(checkin.date).toLocaleDateString()}
                </span>
                <span className="font-medium text-app">{checkin.score}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Upcoming Consultations */}
      {wellness?.upcomingConsultations?.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold text-app mb-4">Upcoming Consultations</h3>
          <div className="space-y-3">
            {wellness.upcomingConsultations.map((consultation, idx) => (
              <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-app">{consultation.clinicianName}</p>
                <p className="text-xs text-gray-600">
                  {new Date(consultation.startTime).toLocaleDateString()}{' '}
                  at {new Date(consultation.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default MyWellnessHome
