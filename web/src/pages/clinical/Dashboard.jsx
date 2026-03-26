import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, Button, LoadingScreen } from '../../components/ui'
import { Users, AlertCircle, Clock, FileText, Video, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const ClinicalDashboard = () => {
  const navigate = useNavigate()
  const [startingMeet, setStartingMeet] = useState(false)

  const handleInstantMeet = async () => {
    setStartingMeet(true)
    try {
      const res = await api.post('/consultations/instant-meet')
      const link = res.meetLink || res.data?.meetLink
      window.open(link, '_blank', 'noopener,noreferrer')
      toast.success('Instant Meet room opened!')
    } catch {
      toast.error('Could not create Meet room')
    } finally {
      setStartingMeet(false)
    }
  }
  const { data: stats, isLoading } = useApi(
    ['clinical', 'stats'],
    () => api.get('/clinical/stats')
  )

  const { data: schedule } = useApi(
    ['clinical', 'schedule'],
    () => api.get('/clinical/schedule/today')
  )

  const { data: alerts } = useApi(
    ['clinical', 'alerts'],
    () => api.get('/clinical/alerts?limit=5')
  )

  if (isLoading) return <LoadingScreen />

  const statCards = [
    {
      label: "Today's Sessions",
      value: stats?.todaysSessions || 0,
      icon: Clock,
      color: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      label: 'Active Alerts',
      value: stats?.activeAlerts || 0,
      icon: AlertCircle,
      color: 'bg-red-50',
      textColor: 'text-red-700',
    },
    {
      label: 'Patients at Risk',
      value: stats?.patientsAtRisk || 0,
      icon: Users,
      color: 'bg-orange-50',
      textColor: 'text-orange-700',
    },
    {
      label: 'Pending Reports',
      value: stats?.pendingReports || 0,
      icon: FileText,
      color: 'bg-purple-50',
      textColor: 'text-purple-700',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-app mb-2">Good morning, Dr. {stats?.clinicianName || 'Clinician'}</h1>
        <p className="text-gray-600">Here's what's happening with your patients today</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className={`${card.color} border-0`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{card.label}</p>
                  <p className={`text-3xl font-bold ${card.textColor}`}>{card.value}</p>
                </div>
                <Icon className={`w-10 h-10 ${card.textColor} opacity-20`} />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 flex-wrap">
        <Button
          variant="primary"
          onClick={() => navigate('/clinical/assessment/new')}
        >
          New Assessment
        </Button>
        <button
          onClick={handleInstantMeet}
          disabled={startingMeet}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-70 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #1a73e8, #1558b0)' }}
        >
          {startingMeet
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
            : <><Video className="w-4 h-4" /> Instant Meet</>}
        </button>
        <Button
          variant="secondary"
          onClick={() => navigate('/clinical/alerts')}
        >
          View Alerts
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate('/clinical/patients')}
        >
          Patient Registry
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card>
          <CardTitle className="mb-4">Today's Schedule</CardTitle>
          {schedule?.sessions && schedule.sessions.length > 0 ? (
            <div className="space-y-3">
              {schedule.sessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-app">{session.patientName}</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(session.startTime), 'HH:mm')}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-cittaa-100 text-cittaa-700 rounded">
                    {session.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No sessions today</p>
          )}
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardTitle className="mb-4">Recent Alerts</CardTitle>
          {alerts?.data && alerts.data.length > 0 ? (
            <div className="space-y-3">
              {alerts.data.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 border-l-4 border-red-500 bg-red-50 rounded"
                >
                  <div className="flex-1">
                    <p className="font-medium text-app">{alert.patientName}</p>
                    <p className="text-xs text-gray-600">{alert.message}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-red-200 text-red-700 rounded whitespace-nowrap ml-2">
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No active alerts</p>
          )}
        </Card>
      </div>
    </div>
  )
}

export default ClinicalDashboard
