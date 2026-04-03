import { useApi } from '../../hooks/useApi'
import { Card, Table, Button, LoadingScreen } from '../../components/ui'
import api from '../../services/api'

export const ManageHRAdmins = () => {
  const { data: admins, isLoading } = useApi(['hr-admins'], () => api.get('/company/hr-admins'))

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
  ]

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">HR Administrators</h1>
        <Button variant="primary">+ Add HR Admin</Button>
      </div>

      <Table columns={columns} data={admins?.data || []} />
    </div>
  )
}

export default ManageHRAdmins
