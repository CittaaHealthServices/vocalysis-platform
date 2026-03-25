import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { TrendLine } from '../../components/charts/TrendLine'
import api from '../../services/api'

export const MyHistory = () => {
  const { data: history, isLoading } = useApi(['my', 'history'], () => api.get('/my/history'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">My Wellness History</h1>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-app mb-4">Wellness Score Trend</h3>
        <TrendLine data={history?.trends || []} />
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-app mb-4">Assessment Timeline</h3>
        <div className="space-y-3">
          {history?.assessments?.map((assessment) => (
            <div key={assessment.id} className="flex items-center justify-between p-3 border-l-4 border-cittaa-700 bg-gray-50 rounded">
              <div>
                <p className="font-medium text-app">{new Date(assessment.date).toLocaleDateString()}</p>
                <p className="text-sm text-gray-600">{assessment.type}</p>
              </div>
              <p className="text-lg font-bold text-cittaa-700">{assessment.score}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default MyHistory
