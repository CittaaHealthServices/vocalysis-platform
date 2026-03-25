import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import api from '../../services/api'

export const Departments = () => {
  const { data: departments, isLoading } = useApi(['departments'], () => api.get('/company/departments'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">Departments</h1>
        <Button variant="primary">+ Add Department</Button>
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
    </div>
  )
}

export default Departments
