import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { AlertTriangle } from 'lucide-react'
import api from '../../services/api'

export const ErrorLog = () => {
  const { data: errors, isLoading } = useApi(['error-log'], () => api.get('/cittaa-admin/errors'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Error Log</h1>

      <div className="space-y-3">
        {errors?.data?.map((error) => (
          <Card
            key={error.id}
            className="p-4 border-l-4 border-red-500"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="font-medium text-app">{error.message}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {error.service} • {new Date(error.timestamp).toLocaleString()}
                </p>
                {error.stackTrace && (
                  <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
                    {error.stackTrace.split('\n').slice(0, 3).join('\n')}
                  </pre>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default ErrorLog
