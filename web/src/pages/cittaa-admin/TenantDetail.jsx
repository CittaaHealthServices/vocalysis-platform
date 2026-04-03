import { useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, LoadingScreen, Tabs } from '../../components/ui'
import api from '../../services/api'

export const TenantDetail = () => {
  const { id } = useParams()
  const { data: tenant, isLoading } = useApi(['tenant', id], () => api.get(`/tenants/${id}`))

  if (isLoading) return <LoadingScreen />

  const tabs = [
    { label: 'Overview', content: <TenantOverview tenant={tenant} /> },
    { label: 'Analytics', content: <div className="text-gray-600">Analytics will appear here</div> },
    { label: 'Users', content: <div className="text-gray-600">Users will appear here</div> },
    { label: 'Settings', content: <div className="text-gray-600">Settings will appear here</div> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-app">{tenant?.companyName}</h1>
        <p className="text-gray-600">{tenant?.industry}</p>
      </div>
      <Tabs tabs={tabs} />
    </div>
  )
}

const TenantOverview = ({ tenant }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6">
        <CardTitle>Company Details</CardTitle>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm text-gray-600">Industry</p>
            <p className="font-medium text-app">{tenant?.industry}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Employees</p>
            <p className="font-medium text-app">{tenant?.employeeCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Subscription Tier</p>
            <p className="font-medium text-cittaa-700">{tenant?.tier}</p>
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <CardTitle>Subscription Details</CardTitle>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-medium text-green-600">Active</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monthly Cost</p>
            <p className="font-medium text-app">${tenant?.monthlyCost}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default TenantDetail
