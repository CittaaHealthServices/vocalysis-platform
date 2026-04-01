import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { TrendLine } from '../../components/charts/TrendLine'
import { RiskDonut } from '../../components/charts/RiskDonut'
import api from '../../services/api'

export const HRAnalytics = () => {
  const {
    data: overview,
    isLoading: loadingOverview,
    isError: errorOverview,
  } = useApi(['analytics', 'overview'], () =>
    api.get('/analytics/overview').then(r => r.data),
    { retry: 1, staleTime: 30_000 }
  )

  const {
    data: trendsResp,
    isLoading: loadingTrends,
    isError: errorTrends,
  } = useApi(['analytics', 'trends'], () =>
    api.get('/analytics/trends').then(r => r.data),
    { retry: 1, staleTime: 30_000 }
  )

  // Only block on overview loading — trends can render empty while loading
  if (loadingOverview) return <LoadingScreen />

  const trendData = trendsResp?.trends || []
  const riskData  = overview?.riskDistribution || null

  // ✅ Fix: completionRate from API is a string e.g. "100.0" — use Number() before .toFixed()
  const completionRate = overview?.completionRate != null
    ? `${Number(overview.completionRate).toFixed(0)}%`
    : '-'

  const avgWellness = overview?.avgWellnessScore != null
    ? Number(overview.avgWellnessScore).toFixed(1)
    : '-'

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">HR Analytics</h1>

      {(errorOverview || errorTrends) && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          Some data could not be loaded. Showing available results.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-cittaa-700">{overview?.totalEmployees ?? '-'}</div>
          <div className="text-sm text-gray-500 mt-1">Total Employees</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{avgWellness}</div>
          <div className="text-sm text-gray-500 mt-1">Avg Wellness Score</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-orange-500">{overview?.needingAttention ?? '-'}</div>
          <div className="text-sm text-gray-500 mt-1">Needing Attention</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{completionRate}</div>
          <div className="text-sm text-gray-500 mt-1">Completion Rate</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Wellness Trend</h3>
          {loadingTrends
            ? <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading trends…</div>
            : <TrendLine data={trendData} />
          }
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
