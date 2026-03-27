import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { TrendLine } from '../../components/charts/TrendLine'
import { RiskDonut } from '../../components/charts/RiskDonut'
import api from '../../services/api'

export const HRAnalytics = () => {
  const { data: analytics, isLoading } = useApi(['analytics', 'hr'], () => api.get('/analytics/overview').then(r => r.data))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">HR Analytics</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Wellness Distribution</h3>
          <RiskDonut data={analytics?.wellnessDistribution} />
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Trends</h3>
          <TrendLine data={analytics?.trends} />
        </Card>
      </div>
    </div>
  )
}

export default HRAnalytics
