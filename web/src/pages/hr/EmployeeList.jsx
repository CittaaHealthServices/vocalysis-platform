import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, Table, Button, Input, Select, LoadingScreen, Modal } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

const ROLE_OPTIONS = [
  { value: '',                      label: 'All Roles' },
  { value: 'EMPLOYEE',              label: 'Employee' },
  { value: 'HR_ADMIN',              label: 'HR Admin' },
  { value: 'CLINICAL_PSYCHOLOGIST', label: 'Psychologist' },
  { value: 'SENIOR_CLINICIAN',      label: 'Senior Clinician' },
  { value: 'COMPANY_ADMIN',         label: 'Company Admin' },
]

const ROLE_LABEL = {
  EMPLOYEE:              '👤 Employee',
  HR_ADMIN:              '📋 HR Admin',
  CLINICAL_PSYCHOLOGIST: '🧠 Psychologist',
  SENIOR_CLINICIAN:      '🩺 Senior Clinician',
  COMPANY_ADMIN:         '🏢 Company Admin',
  CLINICIAN:             '🩺 Clinician',
}

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  department: '',
  joiningDate: '',
  role: 'EMPLOYEE',
}

export const EmployeeList = () => {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ department: '', status: '', search: '', role: '' })
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})

  const { data: employees, isLoading, refetch } = useApi(
    ['employees', filters],
    () => api.get('/employees', { params: filters })
  )

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email,
    },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department', render: (row) => row.department || '—' },
    { key: 'role', label: 'Role', render: (row) => ROLE_LABEL[row.role] || row.role },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          row.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'lastAssessment',
      label: 'Last Assessment',
      render: (row) => row.lastAssessmentDate ? new Date(row.lastAssessmentDate).toLocaleDateString('en-IN') : 'Never',
    },
  ]

  const validate = () => {
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required'
    if (!form.email.trim())     errs.email     = 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address'
    if (!form.role)             errs.role      = 'Role is required'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleAddUser = async () => {
    if (!validate()) return
    setAdding(true)
    try {
      const payload = {
        firstName:   form.firstName.trim(),
        lastName:    form.lastName.trim(),
        email:       form.email.trim().toLowerCase(),
        department:  form.department.trim() || undefined,
        joiningDate: form.joiningDate || undefined,
        phone:       form.phone.trim() || undefined,
        // If adding a non-employee role, route through /users instead
        role:        form.role,
      }

      // Use /employees for EMPLOYEE role, /users for admin roles
      const endpoint = form.role === 'EMPLOYEE' ? '/employees' : '/users'
      await api.post(endpoint, payload)

      toast.success(`${ROLE_OPTIONS.find(r => r.value === form.role)?.label || 'User'} added! A welcome email with login details has been sent.`)
      setAddModalOpen(false)
      setForm(EMPTY_FORM)
      setFormErrors({})
      refetch?.()
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.error
        || err.response?.data?.message
        || 'Failed to add user'
      toast.error(msg)
    } finally {
      setAdding(false)
    }
  }

  const field = (key) => ({
    value: form[key],
    onChange: (e) => {
      setForm({ ...form, [key]: e.target?.value ?? e })
      if (formErrors[key]) setFormErrors({ ...formErrors, [key]: null })
    },
  })

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">Users & Employees</h1>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setAddModalOpen(true)}>+ Add User</Button>
          <Button variant="secondary" onClick={() => navigate('/hr/employees/import')}>Import CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search by name or email…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <Select
            options={ROLE_OPTIONS}
            value={filters.role}
            onChange={(val) => setFilters({ ...filters, role: val })}
          />
          <Select
            options={[
              { value: '', label: 'All Departments' },
              { value: 'engineering', label: 'Engineering' },
              { value: 'hr', label: 'HR' },
              { value: 'sales', label: 'Sales' },
              { value: 'operations', label: 'Operations' },
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
        data={employees?.data?.employees || employees?.data || []}
        loading={isLoading}
        onRowClick={(row) => navigate(`/hr/employees/${row._id || row.id}`)}
        emptyMessage="No users found. Click '+ Add User' to get started."
      />

      {/* ── Add User Modal ── */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => { setAddModalOpen(false); setFormErrors({}) }}
        title="Add New User"
        size="md"
      >
        <div className="space-y-4">

          {/* Role selector at the top */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <Select
              options={ROLE_OPTIONS}
              value={form.role}
              onChange={(val) => setForm({ ...form, role: val })}
            />
            {formErrors.role && <p className="text-red-500 text-xs mt-1">{formErrors.role}</p>}
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <Input placeholder="e.g. Priya" {...field('firstName')} />
              {formErrors.firstName && <p className="text-red-500 text-xs mt-1">{formErrors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <Input placeholder="e.g. Sharma" {...field('lastName')} />
              {formErrors.lastName && <p className="text-red-500 text-xs mt-1">{formErrors.lastName}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email *</label>
            <Input type="email" placeholder="e.g. priya@company.com" {...field('email')} />
            {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
            <Input type="tel" placeholder="e.g. +91 98765 43210" {...field('phone')} />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-gray-400 font-normal">(optional)</span></label>
            <Input placeholder="e.g. Engineering" {...field('department')} />
          </div>

          {/* Joining date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date <span className="text-gray-400 font-normal">(optional)</span></label>
            <Input type="date" {...field('joiningDate')} />
          </div>

          <p className="text-xs text-gray-400">
            A temporary password will be auto-generated and sent to the user's email.
          </p>

          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={handleAddUser} loading={adding}>
              {adding ? 'Adding…' : `Add ${ROLE_OPTIONS.find(r => r.value === form.role)?.label || 'User'}`}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => { setAddModalOpen(false); setFormErrors({}) }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default EmployeeList
