import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Table, Button, Input, LoadingScreen, Modal } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const ManageHRAdmins = () => {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', department: '' })

  const { data: admins, isLoading, refetch } = useApi(['hr-admins'], () => api.get('/company/hr-admins'))

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
  ]

  const handleAdd = async () => {
    if (!form.name || !form.email) {
      toast.error('Name and email are required')
      return
    }
    setAdding(true)
    try {
      await api.post('/company/hr-admins', form)
      toast.success('HR Admin invited — they will receive a setup email')
      setAddModalOpen(false)
      setForm({ name: '', email: '', department: '' })
      refetch?.()
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to add HR Admin')
    } finally {
      setAdding(false)
    }
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">HR Administrators</h1>
        <Button variant="primary" onClick={() => setAddModalOpen(true)}>+ Add HR Admin</Button>
      </div>

      <Table columns={columns} data={admins?.data || []} />

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add HR Admin" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            The new HR Admin will receive an invitation email to set up their account.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <Input
              placeholder="e.g. Rahul Mehta"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email *</label>
            <Input
              type="email"
              placeholder="e.g. rahul@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <Input
              placeholder="e.g. People & Culture"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={handleAdd} loading={adding}>
              Send Invitation
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

export default ManageHRAdmins
