import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { Activity, AlertCircle, Users, Building2, TrendingUp, UserCheck, CalendarDays, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import api from '../../services/api'

export const CittaaAdminOverview = () => {
  const { data: overview, isLoading }     = useApi(['cittaa', 'overview'],      () => api.get('/cittaa-admin/overview'))
  const { data: memberUsage, isLoading: muLoading } = useApi(['cittaa', 'member-usage'], () => api.get('/cittaa-admin/member-usage'))

  if (isLoading || muLoading) return <LoadingScreen />

  const mu = memberUsage?.summary || {}

  const platformStats = [
    { label: 'Active Tenants',      value: overview?.activeTenants     || 0, icon: Building2,   color: 'text-purple-700' },
    { label: 'Total Employees',     value: overview?.totalEmployees    || 0, icon: Users,        color: 'text-blue-700'   },
    { label: 'Assessments Today',   value: overview?.assessmentsToday  || 0, icon: TrendingUp,   color: 'text-teal-700'   },
    { label: 'Active Alerts',       value: overview?.activeAlerts      || 0, icon: AlertCircle,  color: 'text-red-600'    },
  ]

  const memberStats = [
    { label: 'Members Active Today',      value: mu.activeMembersToday      || 0, icon: UserCheck,    color: 'text-green-700'  },
    { label: 'Members This Week',         value: mu.activeMembersThisWeek   || 0, icon: CalendarDays, color: 'text-indigo-700' },
    { label: 'Members This Month',        value: mu.activeMembersThisMonth  || 0, icon: BarChart2,    color: 'text-orange-600' },
    { label: 'Total Unique Members Ever', value: mu.totalMembersEver        || 0, icon: Users,        color: 'text-purple-700' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-app">Platform Control Center</h1>

      {/* System Health */}
      <Card className="p-6 border-l-4 border-green-500">
        <div className="flex items-center gap-4">
          <Activity className="w-8 h-8 text-green-500" />
          <div>
            <p className="text-sm text-gray-600">System Status</p>
            <p className="text-2xl font-bold text-green-600">All Systems Operational</p>
          </div>
        </div>
      </Card>

      {/* Platform Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Platform Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {platformStats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className={`text-3xl font-bold mt-2 ${stat.color}`}>{stat.value.toLocaleString()}</p>
                  </div>
                  <Icon className="w-10 h-10 text-gray-200" />
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Member Usage Stats */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Member Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {memberStats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} className="p-6 border-t-4 border-teal-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className={`text-3xl font-bold mt-2 ${stat.color}`}>{stat.value.toLocaleString()}</p>
                  </div>
                  <Icon className="w-10 h-10 text-gray-200" />
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Active Members (last 14 days) */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Daily Active Members (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={memberUsage?.dailyData || []}>
              <CartesianGrid stroke="#E5E3F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="activeMembers" stroke="#0d9488" strokeWidth={2} dot={false} name="Active Members" />
              <Line type="monotone" dataKey="sessions"      stroke="#6B21A8" strokeWidth={2} dot={false} name="Sessions" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Per-tenant usage this month */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Active Members by Organisation (This Month)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={(memberUsage?.perTenant || []).slice(0, 8)} layout="vertical">
              <CartesianGrid stroke="#E5E3F0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="tenantName" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="activeMembers" fill="#0d9488" name="Active Members" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Monthly Assessments</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={overview?.monthlyData || []}>
              <CartesianGrid stroke="#E5E3F0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="assessments" fill="#6B21A8" name="Assessments" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Top tenants table */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-4">Top Organisations</h3>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2 text-gray-500 font-medium">Organisation</th>
                  <th className="pb-2 text-gray-500 font-medium text-right">Employees</th>
                  <th className="pb-2 text-gray-500 font-medium text-right">Sessions</th>
                  <th className="pb-2 text-gray-500 font-medium text-right">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.topTenants || []).map((t) => (
                  <tr key={t.tenantId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-800">{t.name}</td>
                    <td className="py-2 text-right text-gray-600">{t.employees}</td>
                    <td className="py-2 text-right text-gray-600">{t.sessions}</td>
                    <td className="py-2 text-right">
                      <span className={`font-semibold ${t.wellness >= 70 ? 'text-green-600' : t.wellness >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {t.wellness || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!overview?.topTenants?.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-gray-400">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default CittaaAdminOverview
