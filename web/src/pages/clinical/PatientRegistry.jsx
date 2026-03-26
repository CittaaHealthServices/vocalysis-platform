import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, Button, Input, Select, Table, LoadingScreen } from '../../components/ui'
import api from '../../services/api'

export const PatientRegistry = () => {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ status: '', department: '', search: '' })

  const { data: patients, isLoading } = useApi(
    ['patients', filters],
    () => api.get('/clinical/patients', { params: filters })
  )

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'department', label: 'Department' },
    { key: 'riskLevel', label: 'Risk Level', render: (row) => <span className="font-medium">{row.riskLevel}</span> },
    { key: 'lastAssessment', label: 'Last Assessment', render: (row) => new Date(row.lastAssessment).toLocaleDateString() },
  ]

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">Patient Registry</h1>
        <Button variant="primary" onClick={() => navigate('/clinical/assessment/new')}>
          New Assessment
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search patient..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <Select
            options={[
              { value: '', label: 'All Risk Levels' },
              { value: 'low', label: 'Low Risk' },
              { value: 'medium', label: 'Medium Risk' },
              { value: 'high', label: 'High Risk' },
            ]}
            value={filters.status}
            onChange={(val) => setFilters({ ...filters, status: val })}
          />
          <Select
            options={[
              { value: '', label: 'All Departments' },
              { value: 'engineering', label: 'Engineering' },
              { value: 'sales', label: 'Sales' },
              { value: 'hr', label: 'HR' },
            ]}
            value={filters.department}
            onChange={(val) => setFilters({ ...filters, department: val })}
          />
        </div>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        data={patients?.data || []}
        onRowClick={(row) => navigate(`/clinical/patients/${row.id}`)}
        loading={isLoading}
      />
    </div>
  )
}

export default PatientRegistry
