import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { TrendLine } from '../../components/charts/TrendLine'
import { RiskDonut } from '../../components/charts/RiskDonut'
import api from '../../services/api'

export const CittaaAdminAnalytics = () => {
  const { data: analytics, isLoading } = useApi(['analytics', 'cittaa'], () => api.get('/cittaa-admin/analytics'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Platform Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Assessment Trends</h3>
          <TrendLine data={analytics?.assessmentTrends || []} />
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Risk Distribution</h3>
          <RiskDonut data={analytics?.riskDistribution} />
        </Card>
      </div>
    </div>
  )
}

export default CittaaAdminAnalytics
