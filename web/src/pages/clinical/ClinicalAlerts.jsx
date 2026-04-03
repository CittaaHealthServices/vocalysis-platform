import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import AlertCard from '../../components/alerts/AlertCard'
import api from '../../services/api'

export const ClinicalAlerts = () => {
  const { data: alerts, isLoading } = useApi(['alerts', 'clinical'], () => api.get('/alerts/clinical'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Clinical Alerts</h1>
      <div className="grid grid-cols-1 gap-4">
        {alerts?.data?.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={(id) => api.put(`/alerts/${id}`, { status: 'acknowledged' })}
            onEscalate={(id) => api.put(`/alerts/${id}`, { status: 'escalated' })}
            onResolve={(id) => api.put(`/alerts/${id}`, { status: 'resolved' })}
            userRole="SENIOR_CLINICIAN"
          />
        ))}
      </div>
    </div>
  )
}

export default ClinicalAlerts
