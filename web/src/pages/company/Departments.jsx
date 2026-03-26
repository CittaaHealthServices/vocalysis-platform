import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Button, Input, LoadingScreen, Modal } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const Departments = () => {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deptName, setDeptName] = useState('')

  const { data: departments, isLoading, refetch } = useApi(['departments'], () => api.get('/company/departments'))

  const handleAdd = async () => {
    if (!deptName.trim()) {
      toast.error('Department name is required')
      return
    }
    setAdding(true)
    try {
      await api.post('/company/departments', { name: deptName.trim() })
      toast.success('Department created')
      setAddModalOpen(false)
      setDeptName('')
      refetch?.()
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to create department')
    } finally {
      setAdding(false)
    }
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">Departments</h1>
        <Button variant="primary" onClick={() => setAddModalOpen(true)}>+ Add Department</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {departments?.data?.map((dept) => (
          <Card key={dept.id} className="p-6">
            <h3 className="font-semibold text-app mb-2">{dept.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{dept.employeeCount} employees</p>
            <p className="text-sm font-medium text-cittaa-700">
              Wellness: {dept.averageWellness}%
            </p>
          </Card>
        ))}
      </div>

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Department" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department Name *</label>
            <Input
              placeholder="e.g. Engineering"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={handleAdd} loading={adding}>
              Create Department
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

export default Departments
