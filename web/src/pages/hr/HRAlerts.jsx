import { useApi } from '../../hooks/useApi'
import AlertCard from '../../components/alerts/AlertCard'
import { LoadingScreen } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const HRAlerts = () => {
  const { data: alerts, isLoading, refetch } = useApi(['alerts', 'hr'], () => api.get('/alerts'))

  const handleAction = async (id, status) => {
    try {
      await api.patch(`/alerts/${id}`, { status })
      toast.success(`Alert marked as ${status}`)
      refetch?.()
    } catch {
      toast.error('Failed to update alert')
    }
  }

  if (isLoading) return <LoadingScreen />

  const list = alerts?.alerts || alerts?.data || []

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">HR Alerts</h1>
      {list.length === 0 && (
        <p className="text-gray-500 text-sm">No active alerts.</p>
      )}
      <div className="grid grid-cols-1 gap-4">
        {list.map((alert) => (
          <AlertCard
            key={alert._id || alert.id}
            alert={alert}
            userRole="HR_ADMIN"
            onAcknowledge={(id) => handleAction(id, 'acknowledged')}
            onEscalate={(id) => handleAction(id, 'escalated')}
            onResolve={(id) => handleAction(id, 'resolved')}
          />
        ))}
      </div>
    </div>
  )
}

export default HRAlerts
