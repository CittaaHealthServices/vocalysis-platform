import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, Table, Button, Input, Select, LoadingScreen } from '../../components/ui'
import { useState } from 'react'
import api from '../../services/api'

export const TenantList = () => {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ status: '', tier: '', search: '' })
  const { data: tenants, isLoading } = useApi(['tenants', filters], () => api.get('/tenants', { params: filters }))

  const columns = [
    {
      key: 'displayName',
      label: 'Company Name',
      render: (row) => <span className="font-medium">{row.displayName || row.name || '—'}</span>,
    },
    { key: 'industry', label: 'Industry' },
    { key: 'employeeCount', label: 'Employees' },
    {
      key: 'contractTier',
      label: 'Tier',
      render: (row) => (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 capitalize">
          {row.contractTier || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {row.status || 'active'}
        </span>
      ),
    },
  ]

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">Tenants</h1>
        <Button variant="primary" onClick={() => navigate('/cittaa-admin/tenants/new')}>
          + Onboard New Company
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search company..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <Select
            options={[
              { value: '', label: 'All Tiers' },
              { value: 'starter', label: 'Starter' },
              { value: 'professional', label: 'Professional' },
              { value: 'enterprise', label: 'Enterprise' },
            ]}
            value={filters.tier}
            onChange={(val) => setFilters({ ...filters, tier: val })}
          />
          <Select
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
            ]}
            value={filters.status}
            onChange={(val) => setFilters({ ...filters, status: val })}
          />
        </div>
      </Card>

      <Table
        columns={columns}
        data={tenants?.tenants || tenants?.data || []}
        onRowClick={(row) => navigate(`/cittaa-admin/tenants/${row._id || row.id}`)}
        loading={isLoading}
      />
    </div>
  )
}

export default TenantList
