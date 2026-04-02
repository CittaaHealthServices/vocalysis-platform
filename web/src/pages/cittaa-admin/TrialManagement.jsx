import { useApi } from '../../hooks/useApi'
import { Card, Table, LoadingScreen } from '../../components/ui'
import api from '../../services/api'
import { FlaskConical } from 'lucide-react'

export const TrialManagement = () => {
  const { data, isLoading } = useApi(
    ['trials'],
    () => api.get('/tenants', { params: { status: 'trial' } })
  )

  const rows = data?.data?.tenants || data?.data || []

  const columns = [
    { key: 'name', label: 'Organisation' },
    { key: 'email', label: 'Contact Email' },
    { key: 'trialEndsAt', label: 'Trial Ends', render: r => r.trialEndsAt ? new Date(r.trialEndsAt).toLocaleDateString('en-IN') : '—' },
    { key: 'employeeCount', label: 'Employees', render: r => r.employeeCount ?? '—' },
    { key: 'status', label: 'Status', render: r => (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{r.status || 'trial'}</span>
    )},
  ]

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">⚗️ Trial Management</h1>
      <Table columns={columns} data={rows} loading={isLoading} emptyMessage="No trial organisations at the moment." />
    </div>
  )
}

export default TrialManagement
