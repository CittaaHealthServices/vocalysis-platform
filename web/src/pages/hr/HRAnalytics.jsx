import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { TrendLine } from '../../components/charts/TrendLine'
import { RiskDonut } from '../../components/charts/RiskDonut'
import api from '../../services/api'

export const HRAnalytics = () => {
  const { data: overview, isLoading: loadingOverview } = useApi(['analytics', 'overview'], () =>
    api.get('/analytics/overview').then(r => r.data)
  )
  const { data: trendsResp, isLoading: loadingTrends } = useApi(['analytics', 'trends'], () =>
    api.get('/analytics/trends').then(r => r.data)
  )

  if (loadingOverview || loadingTrends) return <LoadingScreen />

  const trendData = trendsResp?.trends || []
  const riskData = overview?.riskDistribution || null

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">HR Analytics</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-cittaa-700">{overview?.totalEmployees ?? '-'}</div>
          <div className="text-sm text-gray-500 mt-1">Total Employees</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{overview?.avgWellnessScore != null ? overview.avgWellnessScore.toFixed(1) : '-'}</div>
          <div className="text-sm text-gray-500 mt-1">Avg Wellness Score</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-orange-500">{overview?.needingAttention ?? '-'}</div>
          <div className="text-sm text-gray-500 mt-1">Needing Attention</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{overview?.completionRate != null ? overview.completionRate.toFixed(0) + '%' : '-'}</div>
          <div className="text-sm text-gray-500 mt-1">Completion Rate</div>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Wellness Trend</h3>
          <TrendLine data={trendData} />
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Risk Distribution</h3>
          <RiskDonut data={riskData} />
        </Card>
      </div>
    </div>
  )
}

export default HRAnalytics