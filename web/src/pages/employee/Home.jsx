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
            <Button variant="secondary" className="mt-4 w-full" size="sm" onClick={() => navigate('/my/check-in')}>
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-app">Upcoming Consultations</h3>
            <button
              onClick={() => navigate('/my/consultations')}
              className="text-sm text-cittaa-700 font-medium hover:underline"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {wellness.upcomingConsultations.map((consultation, idx) => (
              <div key={idx} className="p-4 bg-gradient-to-r from-blue-50 to-sky-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-app">{consultation.clinicianName}</p>
                  <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full">Upcoming</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {new Date(consultation.startTime).toLocaleDateString()}{' '}
                  at {new Date(consultation.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {consultation.meetLink && (
                  <button
                    onClick={() => window.open(consultation.meetLink, '_blank', 'noopener,noreferrer')}
                    className="flex items-center gap-2 w-full justify-center py-2 rounded-lg text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #1a73e8, #1558b0)' }}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5"><path d="M22.5 12.23c0-.64-.06-1.25-.16-1.84H12v3.48h5.9a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-7.73z" fill="white"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/><path d="M5.84 14.09a6.94 6.94 0 0 1 0-4.18V7.07H2.18a11.09 11.09 0 0 0 0 9.86l3.66-2.84z" fill="white"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/></svg>
                    Join Google Meet
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default MyWellnessHome
