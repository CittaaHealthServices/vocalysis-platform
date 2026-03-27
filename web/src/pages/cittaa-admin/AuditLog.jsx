import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import api from '../../services/api'

const IST_OPTS = { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }

const OUTCOME_STYLES = {
  success: 'bg-green-100 text-green-700',
  failure: 'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-500',
}

export const AuditLog = () => {
  const [page, setPage] = useState(1)
  const { data: logs, isLoading } = useApi(
    ['audit-log', page],
    () => api.get('/cittaa-admin/audit-log', { params: { page, limit: 50 } })
  )

  if (isLoading) return <LoadingScreen />

  const list = logs?.data || []
  const meta = logs?.meta || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-app">Audit Log</h1>
        {meta.total > 0 && (
          <span className="text-sm text-gray-500">{meta.total} total entries</span>
        )}
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No audit log entries yet. Actions taken in the platform will appear here.
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((log) => {
            const outcomeStyle = OUTCOME_STYLES[log.outcome] || OUTCOME_STYLES.default
            return (
              <Card key={log.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-app">{log.action}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${outcomeStyle}`}>
                        {log.outcome || 'success'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      By <span className="font-medium">{log.user || log.userId || '—'}</span>
                      {log.tenantId && <span> · Tenant: {log.tenantId}</span>}
                      {' '}·{' '}
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', IST_OPTS) + ' IST' : '—'}
                    </p>
                    {log.ipAddress && (
                      <p className="text-xs text-gray-400 mt-0.5">IP: {log.ipAddress}</p>
                    )}
                  </div>
                  {log.resource && (
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded whitespace-nowrap">
                      {log.resource}
                    </span>
                  )}
                </div>
              </Card>
            )
          })}
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

export default AuditLog
