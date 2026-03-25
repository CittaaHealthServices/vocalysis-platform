import { useApi } from '../../hooks/useApi'
import AlertCard from '../../components/alerts/AlertCard'
import { LoadingScreen } from '../../components/ui'
import api from '../../services/api'

export const HRAlerts = () => {
  const { data: alerts, isLoading } = useApi(['alerts', 'hr'], () => api.get('/alerts/hr'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">HR Alerts</h1>
      <div className="grid grid-cols-1 gap-4">
        {alerts?.data?.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            userRole="HR_ADMIN"
          />
        ))}
      </div>
    </div>
  )
}

export default HRAlerts
