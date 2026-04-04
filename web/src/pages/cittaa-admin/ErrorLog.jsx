import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight, XCircle } from 'lucide-react'
import api from '../../services/api'

const IST_OPTS = {
  timeZone: 'Asia/Kolkata',
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true,
}

const SEVERITY_STYLES = {
  critical: {
    border: 'border-red-500',
    badge:  'bg-red-100 text-red-700',
    icon:   <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />,
    label:  'Critical',
  },
  error: {
    border: 'border-orange-400',
    badge:  'bg-orange-100 text-orange-700',
    icon:   <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />,
    label:  'Error',
  },
  warning: {
    border: 'border-yellow-400',
    badge:  'bg-yellow-100 text-yellow-700',
    icon:   <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />,
    label:  'Warning',
  },
}

function ErrorCard({ error, onResolved }) {
  const [expanded,  setExpanded]  = useState(false)
  const [resolving, setResolving] = useState(false)
  const sty = SEVERITY_STYLES[error.severity] || SEVERITY_STYLES.error

  const handleResolve = async () => {
    setResolving(true)
    try {
      await api.patch(`/cittaa-admin/errors/${error.id}/resolve`, {
        resolution: 'Marked resolved via admin panel',
      })
      onResolved(error.id)
    } catch (_) { /* ignore */ } finally {
      setResolving(false)
    }
  }

  return (
    <Card className={`p-4 border-l-4 ${sty.border} ${error.resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        {sty.icon}
        <div className="flex-1 min-w-0">

          {/* Top row */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className="font-medium text-app break-words">{error.message || 'Unknown error'}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sty.badge}`}>
                {sty.label}
              </span>
              {error.resolved && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Resolved
                </span>
              )}
            </div>
          </div>

          {/* Meta */}
          <p className="text-xs text-gray-500 mt-1">
            <span className="font-medium">{error.service || 'api'}</span>
            {error.method && error.path && <span> · {error.method} {error.path}</span>}
            {error.statusCode && <span> · HTTP {error.statusCode}</span>}
            {error.userId && <span> · User: {error.userId}</span>}
            {' · '}
            {error.timestamp
              ? new Date(error.timestamp).toLocaleString('en-IN', IST_OPTS) + ' IST'
              : '—'}
          </p>

          {/* Stack trace toggle */}
          {error.stackTrace && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                {expanded
                  ? <ChevronDown  className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />}
                {expanded ? 'Hide' : 'Show'} stack trace
              </button>
              {expanded && (
                <pre className="text-xs bg-gray-950 text-red-300 p-3 rounded mt-2 overflow-x-auto leading-relaxed max-h-48 overflow-y-auto">
                  {error.stackTrace}
                </pre>
              )}
            </div>
          )}

          {/* Resolve button */}
          {!error.resolved && (
            <div className="mt-2">
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-600 rounded border transition-colors disabled:opacity-50"
              >
                {resolving ? 'Resolving…' : '✓ Mark Resolved'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export const ErrorLog = () => {
  const [page,         setPage]         = useState(1)
  const [severity,     setSeverity]     = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [resolvedIds,  setResolvedIds]  = useState(new Set())

  const { data: errors, isLoading } = useApi(
    ['error-log', page, severity, showResolved],
    () => api.get('/cittaa-admin/errors', {
      params: {
        page, limit: 50,
        ...(severity    && { severity }),
        ...(showResolved && { resolved: true }),
      },
    })
  )

  if (isLoading) return <LoadingScreen />

  const list = (errors?.data || []).filter(e => !resolvedIds.has(e.id))
  const meta = errors?.meta || {}

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-app">Error Log</h1>
          {meta.unresolvedCount > 0 && (
            <p className="text-sm text-red-500 mt-1">
              {meta.criticalCount > 0
                ? `${meta.criticalCount} critical · ${meta.unresolvedCount} unresolved`
                : `${meta.unresolvedCount} unresolved errors`}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={severity}
            onChange={e => { setSeverity(e.target.value); setPage(1) }}
            className="text-sm border rounded-lg px-2 py-1.5 bg-white text-gray-700"
          >
            <option value="">All severities</option>
            <option value="critical">Critical only</option>
            <option value="error">Errors only</option>
            <option value="warning">Warnings only</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => { setShowResolved(e.target.checked); setPage(1) }}
              className="rounded"
            />
            Show resolved
          </label>
        </div>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-gray-500">No errors recorded. System is healthy!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map(error => (
            <ErrorCard
              key={error.id}
              error={error}
              onResolved={id => setResolvedIds(prev => new Set([...prev, id]))}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
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
