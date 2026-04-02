import { useApi } from '../../hooks/useApi'
import { Card, Table, LoadingScreen } from '../../components/ui'
import api from '../../services/api'
import { AlertTriangle } from 'lucide-react'

const RISK_STYLE = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH:     'bg-orange-100 text-orange-700',
  MODERATE: 'bg-yellow-100 text-yellow-700',
  LOW:      'bg-green-100 text-green-700',
}

export const EscalationManagement = () => {
  const { data, isLoading } = useApi(
    ['escalations'],
    () => api.get('/alerts', { params: { type: 'escalation', status: 'open', limit: 50 } })
  )

  const rows = data?.data?.alerts || data?.data || []

  const columns = [
    { key: 'employee', label: 'Employee', render: r => r.employeeName || r.employee?.name || '—' },
    { key: 'organisation', label: 'Organisation', render: r => r.tenantName || r.tenant?.name || '—' },
    { key: 'riskLevel', label: 'Risk', render: r => (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RISK_STYLE[r.riskLevel] || RISK_STYLE.MODERATE}`}>
        {r.riskLevel || 'MODERATE'}
      </span>
    )},
    { key: 'createdAt', label: 'Created', render: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '—' },
    { key: 'status', label: 'Status', render: r => (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {r.status || 'open'}
      </span>
    )},
  ]

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">🚨 Escalation Management</h1>
      <Table columns={columns} data={rows} loading={isLoading} emptyMessage="No escalations at the moment. 🎉" />
    </div>
  )
}

export default EscalationManagement
