import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, Table, Button, Input, Select, LoadingScreen, Modal } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const EmployeeList = () => {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ department: '', status: '', search: '' })
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', employeeId: '', department: '', joiningDate: '' })

  const { data: employees, isLoading, refetch } = useApi(
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

  const handleAddEmployee = async () => {
    if (!form.name || !form.email) {
      toast.error('Name and email are required')
      return
    }
    setAdding(true)
    try {
      await api.post('/employees', form)
      toast.success('Employee added successfully')
      setAddModalOpen(false)
      setForm({ name: '', email: '', employeeId: '', department: '', joiningDate: '' })
      refetch?.()
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to add employee')
    } finally {
      setAdding(false)
    }
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">Employees</h1>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setAddModalOpen(true)}>+ Add Employee</Button>
          <Button variant="secondary" onClick={() => navigate('/hr/employees/import')}>Import CSV</Button>
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

      {/* Add Employee Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Employee" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <Input
              placeholder="e.g. Priya Sharma"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email *</label>
            <Input
              type="email"
              placeholder="e.g. priya@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
            <Input
              placeholder="e.g. EMP-001"
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <Input
              placeholder="e.g. Engineering"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
            <Input
              type="date"
              value={form.joiningDate}
              onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={handleAddEmployee} loading={adding}>
              Add Employee
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default EmployeeList
