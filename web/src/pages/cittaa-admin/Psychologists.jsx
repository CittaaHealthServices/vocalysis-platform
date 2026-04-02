import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Table, Button, LoadingScreen, Modal, Input } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Brain } from 'lucide-react'

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', specialization: '' }

export const Psychologists = () => {
  const [addOpen, setAddOpen]       = useState(false)
  const [form, setForm]             = useState(EMPTY)
  const [adding, setAdding]         = useState(false)

  const { data, isLoading, refetch } = useApi(
    ['psychologists'],
    () => api.get('/users', { params: { role: 'CLINICAL_PSYCHOLOGIST,SENIOR_CLINICIAN' } })
  )

  const rows = data?.data?.users || data?.data || []

  const columns = [
    { key: 'name', label: 'Name', render: r => `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: r => r.role === 'SENIOR_CLINICIAN' ? '🩺 Senior Clinician' : '🧠 Psychologist' },
    { key: 'isActive', label: 'Status', render: r => (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {r.isActive ? 'Active' : 'Inactive'}
      </span>
    )},
  ]

  const handleAdd = async () => {
    if (!form.email || !form.firstName) return toast.error('Name and email required')
    setAdding(true)
    try {
      await api.post('/users', { ...form, role: 'CLINICAL_PSYCHOLOGIST' })
      toast.success('Psychologist added! Welcome email sent.')
      setAddOpen(false)
      setForm(EMPTY)
      refetch?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add psychologist')
    } finally {
      setAdding(false)
    }
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">🧠 Psychologists</h1>
        <Button variant="primary" onClick={() => setAddOpen(true)}>+ Add Psychologist</Button>
      </div>

      <Table
        columns={columns}
        data={rows}
        loading={isLoading}
        emptyMessage="No psychologists found. Click '+ Add Psychologist' to add one."
      />

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Psychologist" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Priya" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="e.g. Sharma" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="dr.priya@cittaa.in" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
            <Input value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. CBT, Anxiety, Trauma" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={handleAdd} loading={adding}>
              {adding ? 'Adding…' : 'Add Psychologist'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Psychologists
