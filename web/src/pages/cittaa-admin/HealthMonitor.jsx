import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { AlertCircle, AlertTriangle, CheckCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import api from '../../services/api'

const IST_OPTS = {
  timeZone: 'Asia/Kolkata',
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true,
}

function StatusBadge({ status }) {
  if (status === 'healthy') return (
    <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />Healthy
    </span>
  )
  if (status === 'degraded') return (
    <span className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full inline-block" />Degraded
    </span>
  )
  return (
    <span className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />Unhealthy
    </span>
  )
}

function ServiceIcon({ status }) {
  if (status === 'healthy')  return <CheckCircle  className="w-5 h-5 text-green-500"  />
  if (status === 'degraded') return <AlertTriangle className="w-5 h-5 text-yellow-500" />
  return                            <AlertCircle   className="w-5 h-5 text-red-500"    />
}

function OverallCard({ overall }) {
  if (overall === 'operational') return (
    <Card className="p-6 bg-green-50 border-0">
      <div className="flex items-center gap-2 mb-1">
        <Wifi className="w-4 h-4 text-green-600" />
        <p className="text-sm text-gray-600">System Status</p>
      </div>
      <p className="text-2xl font-bold text-green-600">All Systems Operational</p>
    </Card>
  )
  if (overall === 'degraded') return (
    <Card className="p-6 bg-yellow-50 border-0">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        <p className="text-sm text-gray-600">System Status</p>
      </div>
      <p className="text-2xl font-bold text-yellow-600">Partial Degradation</p>
    </Card>
  )
  return (
    <Card className="p-6 bg-red-50 border-0">
      <div className="flex items-center gap-2 mb-1">
        <WifiOff className="w-4 h-4 text-red-600" />
        <p className="text-sm text-gray-600">System Status</p>
      </div>
      <p className="text-2xl font-bold text-red-600">Major Outage</p>
    </Card>
  )
}

export const HealthMonitor = () => {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data: health, isLoading, error } = useApi(
    ['health', refreshKey],
    () => api.get('/cittaa-admin/health')
  )

  if (isLoading) return <LoadingScreen />

  if (error || !health?.data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-app">Health Monitor</h1>
        <Card className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-600">Failed to load health data.</p>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
          >
            Retry
          </button>
        </Card>
      </div>
    )
  }

  const d        = health.data
  const services = d.services || []
  const checkedAt = d.checkedAt
    ? new Date(d.checkedAt).toLocaleString('en-IN', IST_OPTS) + ' IST'
    : '—'

  const apiSvc = services.find(s => s.key === 'api_server')

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-app">Health Monitor</h1>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-purple-700 border rounded-lg hover:border-purple-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OverallCard overall={d.overall} />

        <Card className="p-6 bg-blue-50 border-0">
          <p className="text-sm text-gray-600">Avg Response Time</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{d.avgResponseTime || '—'}</p>
        </Card>

        <Card className="p-6 bg-purple-50 border-0">
          <p className="text-sm text-gray-600">Last Checked</p>
          <p className="text-sm font-semibold text-purple-600 mt-3">{checkedAt}</p>
        </Card>
      </div>

      {/* Live service cards */}
      <div className="space-y-3">
        {services.map((svc) => (
          <Card key={svc.key} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ServiceIcon status={svc.status} />
                <div>
                  <p className="font-medium text-app">{svc.name}</p>
                  <p className="text-xs text-gray-500">
                    {svc.uptime} uptime (24 h)
                    {svc.responseTime ? ` · ${svc.responseTime} response` : ''}
                    {svc.error ? <span className="text-red-500"> · {svc.error}</span> : null}
                  </p>

                  {/* Queue detail for audio processing */}
                  {svc.key === 'vocoware' && svc.detail && !svc.error && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Active: {svc.detail.active ?? 0} · Waiting: {svc.detail.waiting ?? 0} · Failed: {svc.detail.failed ?? 0}
                    </p>
                  )}

                  {/* Collection count for MongoDB */}
                  {svc.key === 'mongodb' && svc.detail && !svc.error && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Collections: {svc.detail.collections ?? '—'}
                    </p>
                  )}

                  {/* Memory for Redis */}
                  {svc.key === 'redis' && svc.detail?.usedMemory && !svc.error && (
                    <p className="text-xs text-gray-400 mt-0.5">Memory used: {svc.detail.usedMemory}</p>
                  )}
                </div>
              </div>
              <StatusBadge status={svc.status} />
            </div>
          </Card>
        ))}
      </div>

      {/* API process details panel */}
      {apiSvc?.detail && (
        <Card className="p-4 bg-gray-50 border-0">
          <p className="text-xs font-medium text-gray-500 mb-3">API Process Details</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
            {(() => {
              const detail   = apiSvc.detail
              const mem      = detail.memory || {}
              const totalSec = detail.uptime || 0
              const h = Math.floor(totalSec / 3600)
              const m = Math.floor((totalSec % 3600) / 60)
              return (
                <>
                  <div>
                    <span className="text-gray-400 block">Uptime</span>
                    <strong>{h}h {m}m</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Heap Used</span>
                    <strong>{mem.heapUsed ? (mem.heapUsed / 1024 / 1024).toFixed(1) + ' MB' : '—'}</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Heap Total</span>
                    <strong>{mem.heapTotal ? (mem.heapTotal / 1024 / 1024).toFixed(1) + ' MB' : '—'}</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Node.js</span>
                    <strong>{detail.nodeVersion || '—'}</strong>
                  </div>
                </>
              )
            })()}
          </div>
        </Card>
      )}
    </div>
  )
}

export default HealthMonitor
