import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Table, Button, Input, Select, LoadingScreen } from '../../components/ui'
import api from '../../services/api'

export const EmployeeList = () => {
  const [filters, setFilters] = useState({ department: '', status: '', search: '' })

  const { data: employees, isLoading } = useApi(
    ['employees', filters],
    () => api.get('/employees', { params: filters })
  )

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'department', label: 'Department' },
    { key: 'wellnessStatus', label: 'Wellness Status' },
    { key: 'lastAssessment', label: 'Last Assessment', render: (row) => row.lastAssessment ? new Date(row.lastAssessment).toLocaleDateString() : 'N/A' },
  ]

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">Employees</h1>
        <div className="flex gap-2">
          <Button variant="primary">+ Add Employee</Button>
          <Button variant="secondary">Import CSV</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search employee..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <Select
            options={[
              { value: '', label: 'All Departments' },
              { value: 'engineering', label: 'Engineering' },
              { value: 'sales', label: 'Sales' },
            ]}
            value={filters.department}
            onChange={(val) => setFilters({ ...filters, department: val })}
          />
          <Select
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            value={filters.status}
            onChange={(val) => setFilters({ ...filters, status: val })}
          />
        </div>
      </Card>

      <Table
        columns={columns}
        data={employees?.data || []}
        loading={isLoading}
      />
    </div>
  )
}

export default EmployeeList
