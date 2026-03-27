import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { TrendLine } from '../../components/charts/TrendLine'
import api from '../../services/api'

export const MyHistory = () => {
  const { data: historyResponse, isLoading } = useApi(['my', 'history'], () => api.get('/my/history'))
  const sessions = historyResponse?.data || []

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">My Wellness History</h1>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-app mb-4">Wellness Score Trend</h3>
        {sessions.length > 0 ? (
          <TrendLine data={sessions} />
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No sessions yet. Complete your first check-in to see your trend.</p>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-app mb-4">Assessment Timeline</h3>
        {sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 border-l-4 border-cittaa-700 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-app">{new Date(session.date).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-600 capitalize">{session.mood || 'Wellness Assessment'}</p>
                </div>
                <p className="text-lg font-bold text-cittaa-700">{session.score ?? '—'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No assessment history yet.</p>
        )}
      </Card>
    </div>
  )
}

export default MyHistory
