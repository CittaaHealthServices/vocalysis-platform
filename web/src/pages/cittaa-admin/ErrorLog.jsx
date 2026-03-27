import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import api from '../../services/api'

const IST_OPTS = { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }

export const ErrorLog = () => {
  const [page, setPage] = useState(1)
  const { data: errors, isLoading } = useApi(
    ['error-log', page],
    () => api.get('/cittaa-admin/errors', { params: { page, limit: 50 } })
  )

  if (isLoading) return <LoadingScreen />

  const list = errors?.data || []
  const meta = errors?.meta || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-app">Error Log</h1>
        {meta.total > 0 && (
          <span className="text-sm text-gray-500">{meta.total} total errors</span>
        )}
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-gray-500">No errors recorded. System is healthy!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((error) => (
            <Card key={error.id} className="p-4 border-l-4 border-red-500">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-app">{error.message || error.action || 'Unknown error'}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">{error.service || 'api'}</span>
                    {error.statusCode && <span> · Status {error.statusCode}</span>}
                    {error.userId && <span> · User: {error.userId}</span>}
                    {' '}·{' '}
                    {error.timestamp ? new Date(error.timestamp).toLocaleString('en-IN', IST_OPTS) + ' IST' : '—'}
                  </p>
                  {error.stackTrace && (
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto text-red-700">
                      {error.stackTrace.split('\n').slice(0, 3).join('\n')}
                    </pre>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {meta.pages > 1 && (
        <div className="flex gap-2 justify-center">
          <button
            className="px-3 py-1 text-sm rounded border disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >← Prev</button>
          <span className="px-3 py-1 text-sm text-gray-600">Page {page} / {meta.pages}</span>
          <button
            className="px-3 py-1 text-sm rounded border disabled:opacity-40"
            disabled={page >= meta.pages}
            onClick={() => setPage(p => p + 1)}
          >Next →</button>
        </div>
      )}
    </div>
  )
}

export default ErrorLog
