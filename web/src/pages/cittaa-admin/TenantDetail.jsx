import { useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, LoadingScreen, Tabs } from '../../components/ui'
import api from '../../services/api'

export const TenantDetail = () => {
  const { id } = useParams()
  const { data: raw, isLoading } = useApi(['tenant', id], () => api.get(`/tenants/${id}`))

  if (isLoading) return <LoadingScreen />

  // Backend returns { tenant: {...}, stats: {...} } — unwrap
  const tenant = raw?.tenant || raw

  const tabs = [
    { label: 'Overview', content: <TenantOverview tenant={tenant} /> },
    { label: 'Analytics', content: <div className="text-gray-600 p-4">Analytics will appear here once data is collected.</div> },
    { label: 'Users', content: <TenantUsers tenantId={id} /> },
    { label: 'Settings', content: <div className="text-gray-600 p-4">Settings will appear here.</div> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-app">{tenant?.displayName || tenant?.legalName || '—'}</h1>
        <p className="text-gray-600">{tenant?.industry} · {tenant?.city}</p>
      </div>
      <Tabs tabs={tabs} />
    </div>
  )
}

const TenantOverview = ({ tenant }) => {
  if (!tenant) return <div className="text-gray-500 p-4">No tenant data found.</div>
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6">
        <CardTitle>Company Details</CardTitle>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm text-gray-600">Legal Name</p>
            <p className="font-medium text-app">{tenant?.legalName || tenant?.displayName || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Industry</p>
            <p className="font-medium text-app">{tenant?.industry || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Employees</p>
            <p className="font-medium text-app">{tenant?.employeeCount ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">City</p>
            <p className="font-medium text-app">{tenant?.city || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Contact Email</p>
            <p className="font-medium text-app">{tenant?.contactEmail || '—'}</p>
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <CardTitle>Subscription Details</CardTitle>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${tenant?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {tenant?.status || 'active'}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">Contract Tier</p>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 capitalize">
              {tenant?.contractTier || '—'}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-600">Assessment Quota / Month</p>
            <p className="font-medium text-app">{tenant?.monthlyAssessmentQuota ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tenant ID</p>
            <p className="font-mono text-xs text-gray-500">{tenant?.tenantId || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Created</p>
            <p className="font-medium text-app">
              {tenant?.createdAt ? new Date(tenant.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }) : '—'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

const TenantUsers = ({ tenantId }) => {
  return (
    <div className="text-gray-500 p-4 text-sm">
      User management for this tenant will appear here.
    </div>
  )
}

export default TenantDetail
