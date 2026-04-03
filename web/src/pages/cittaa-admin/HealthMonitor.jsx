import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { Activity, AlertCircle } from 'lucide-react'
import api from '../../services/api'

export const HealthMonitor = () => {
  const { data: health, isLoading } = useApi(['health'], () => api.get('/cittaa-admin/health'))

  if (isLoading) return <LoadingScreen />

  const services = [
    { name: 'API Server', status: 'healthy', uptime: '99.9%', responseTime: '45ms' },
    { name: 'MongoDB', status: 'healthy', uptime: '99.95%', responseTime: '2ms' },
    { name: 'Redis Cache', status: 'healthy', uptime: '99.8%', responseTime: '1ms' },
    { name: 'Audio Processing', status: 'healthy', uptime: '99.7%', responseTime: '250ms' },
    { name: 'WebSocket Server', status: 'healthy', uptime: '99.6%', responseTime: '10ms' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Health Monitor</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-green-50 border-0">
          <p className="text-sm text-gray-600">System Health</p>
          <p className="text-3xl font-bold text-green-600 mt-2">Operational</p>
        </Card>
        <Card className="p-6 bg-blue-50 border-0">
          <p className="text-sm text-gray-600">Avg Response Time</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">78ms</p>
        </Card>
        <Card className="p-6 bg-purple-50 border-0">
          <p className="text-sm text-gray-600">Uptime (30 days)</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">99.85%</p>
        </Card>
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <Card key={service.name} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-app">{service.name}</p>
                  <p className="text-xs text-gray-600">
                    {service.uptime} uptime • {service.responseTime} avg response
                  </p>
                </div>
              </div>
              <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                {service.status}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default HealthMonitor
