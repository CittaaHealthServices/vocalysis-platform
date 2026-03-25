import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, Button, LoadingScreen, Select } from '../../components/ui'
import { RiskDonut } from '../../components/charts/RiskDonut'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../services/api'

export const HROverview = () => {
  const { data: overview, isLoading } = useApi(['hr', 'overview'], () => api.get('/hr/overview'))

  if (isLoading) return <LoadingScreen />

  const stats = [
    { label: 'Total Employees', value: overview?.totalEmployees || 0 },
    { label: 'Assessed This Month', value: overview?.assessedThisMonth || 0 },
    { label: 'Needing Attention', value: overview?.needingAttention || 0 },
    { label: 'Pending Invitations', value: overview?.pendingInvitations || 0 },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-app">HR Wellness Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="text-3xl font-bold text-cittaa-700 mt-2">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <CardTitle className="mb-4">Employee Risk Distribution</CardTitle>
          <RiskDonut data={overview?.riskDistribution} />
        </Card>

        <Card className="p-6">
          <CardTitle className="mb-4">Assessment Activity</CardTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={overview?.activityData || []}>
              <CartesianGrid stroke="#E5E3F0" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6B21A8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6">
        <CardTitle className="mb-4">Pending Actions</CardTitle>
        <div className="space-y-3">
          {overview?.pendingActions?.map((action, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-app">{action.title}</span>
              <Button size="sm" variant="primary">
                Action
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default HROverview
