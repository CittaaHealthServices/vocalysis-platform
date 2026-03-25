import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { RiskDonut } from '../../components/charts/RiskDonut'
import api from '../../services/api'

export const CompanyOverview = () => {
  const { data: overview, isLoading } = useApi(['company', 'overview'], () => api.get('/company/overview'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Company Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-gray-600">Total Employees</p>
          <p className="text-3xl font-bold text-cittaa-700">{overview?.totalEmployees}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Active Assessments</p>
          <p className="text-3xl font-bold text-cittaa-700">{overview?.activeAssessments}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Average Wellness</p>
          <p className="text-3xl font-bold text-cittaa-700">{overview?.averageWellness}%</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Risk Alerts</p>
          <p className="text-3xl font-bold text-red-600">{overview?.riskAlerts}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-app mb-4">Employee Wellness Distribution</h3>
        <RiskDonut data={overview?.distribution} />
      </Card>
    </div>
  )
}

export default CompanyOverview
