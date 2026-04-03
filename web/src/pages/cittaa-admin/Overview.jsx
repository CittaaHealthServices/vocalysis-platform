import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { Activity, AlertCircle, Users, Building2, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../services/api'

export const CittaaAdminOverview = () => {
  const { data: overview, isLoading } = useApi(['cittaa', 'overview'], () => api.get('/cittaa-admin/overview'))

  if (isLoading) return <LoadingScreen />

  const stats = [
    { label: 'Active Tenants', value: overview?.activeTenants || 0, icon: Building2 },
    { label: 'Total Employees', value: overview?.totalEmployees || 0, icon: Users },
    { label: 'Assessments Today', value: overview?.assessmentsToday || 0, icon: TrendingUp },
    { label: 'Active Alerts', value: overview?.activeAlerts || 0, icon: AlertCircle },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-app">Platform Control Center</h1>

      {/* System Health */}
      <Card className="p-6 border-l-4 border-cittaa-700">
        <div className="flex items-center gap-4">
          <Activity className="w-8 h-8 text-green-500" />
          <div>
            <p className="text-sm text-gray-600">System Status</p>
            <p className="text-2xl font-bold text-green-600">All Systems Operational</p>
          </div>
        </div>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-cittaa-700 mt-2">{stat.value}</p>
                </div>
                <Icon className="w-10 h-10 text-gray-300" />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Assessments Per Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={overview?.dailyData || []}>
              <CartesianGrid stroke="#E5E3F0" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6B21A8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Tenant Growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={overview?.tenantGrowth || []}>
              <CartesianGrid stroke="#E5E3F0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}

export default CittaaAdminOverview
