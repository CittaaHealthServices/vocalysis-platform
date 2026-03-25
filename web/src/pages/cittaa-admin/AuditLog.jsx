import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import api from '../../services/api'

export const AuditLog = () => {
  const { data: logs, isLoading } = useApi(['audit-log'], () => api.get('/cittaa-admin/audit-log'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Audit Log</h1>

      <div className="space-y-2">
        {logs?.data?.map((log) => (
          <Card key={log.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-app">{log.action}</p>
                <p className="text-sm text-gray-600">
                  By {log.user} • {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                {log.resource}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default AuditLog
