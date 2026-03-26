import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import {
  TrendingUp, Users, Building2, DollarSign, Activity, AlertCircle,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

const COLORS = ['#7c3aed', '#a78bfa', '#c4b5fd', '#ede9fe']

function StatCard({ label, value, sub, trend, icon: Icon, color = 'violet' }) {
  const colorMap = {
    violet: { bg: '#f5f3ff', icon: '#7c3aed', value: '#4c1d95' },
    green:  { bg: '#f0fdf4', icon: '#16a34a', value: '#14532d' },
    red:    { bg: '#fff1f2', icon: '#dc2626', value: '#7f1d1d' },
    blue:   { bg: '#eff6ff', icon: '#2563eb', value: '#1e3a5f' },
  }
  const c = colorMap[color] || colorMap.violet
  const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus
  const trendColor = trend > 0 ? '#16a34a' : trend < 0 ? '#dc2626' : '#9ca3af'

  return (
    <div className="rounded-2xl p-6 border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="rounded-xl p-2.5" style={{ background: c.bg }}>
          <Icon className="w-5 h-5" style={{ color: c.icon }} />
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: trendColor }}>
            <TrendIcon className="w-3.5 h-3.5" />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-3xl font-bold mb-1" style={{ color: c.value }}>{value}</div>
      <div className="text-sm text-gray-500 font-medium">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export const CEODashboard = () => {
  const { user } = useAuth()
  const { data: stats, isLoading } = useApi(['ceo', 'overview'], () => api.get('/cittaa-admin/overview'))

  // Mock enriched data while real API is being wired
  const enriched = {
    activeTenants:     stats?.activeTenants     || 12,
    totalEmployees:    stats?.totalEmployees     || 4870,
    assessmentsToday:  stats?.assessmentsToday   || 134,
    activeAlerts:      stats?.activeAlerts       || 7,
    mrr:               stats?.mrr                || '₹4.2L',
    arr:               stats?.arr                || '₹50.4L',
    nps:               stats?.nps                || 72,
    avgWellnessScore:  stats?.avgWellnessScore   || 68,
    growthMoM:         stats?.growthMoM          || 18,
    churnRate:         stats?.churnRate          || 2,
    monthlyData: stats?.monthlyData || [
      { month: 'Oct', tenants: 8,  assessments: 980,  mrr: 280000 },
      { month: 'Nov', tenants: 9,  assessments: 1200, mrr: 315000 },
      { month: 'Dec', tenants: 10, assessments: 1050, mrr: 350000 },
      { month: 'Jan', tenants: 11, assessments: 1380, mrr: 385000 },
      { month: 'Feb', tenants: 12, assessments: 1620, mrr: 420000 },
      { month: 'Mar', tenants: 12, assessments: 1840, mrr: 420000 },
    ],
    riskDist: stats?.riskDist || [
      { name: 'Low Risk',      value: 62 },
      { name: 'Medium Risk',   value: 25 },
      { name: 'High Risk',     value: 10 },
      { name: 'Critical',      value: 3  },
    ],
    topTenants: stats?.topTenants || [
      { name: 'TechCorp India',      employees: 850, wellness: 74, alerts: 2 },
      { name: 'GlobalBank',          employees: 1200, wellness: 65, alerts: 5 },
      { name: 'MedLife Hospital',    employees: 420, wellness: 71, alerts: 1 },
      { name: 'StartupHub',          employees: 150, wellness: 79, alerts: 0 },
      { name: 'ManufactCo',          employees: 680, wellness: 61, alerts: 3 },
    ],
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          Executive Dashboard
        </h1>
        <p className="text-gray-500">Platform-wide business intelligence · Vocalysis 2.0</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Clients"
          value={enriched.activeTenants}
          sub="organisations on platform"
          trend={enriched.growthMoM}
          icon={Building2}
          color="violet"
        />
        <StatCard
          label="Monthly Revenue"
          value={enriched.mrr}
          sub={`ARR ${enriched.arr}`}
          trend={8}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          label="Employees Served"
          value={enriched.totalEmployees.toLocaleString()}
          sub="across all organisations"
          trend={12}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Active Alerts"
          value={enriched.activeAlerts}
          sub="requiring review"
          trend={enriched.activeAlerts > 5 ? -15 : 5}
          icon={AlertCircle}
          color={enriched.activeAlerts > 10 ? 'red' : 'violet'}
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Net Promoter Score"  value={enriched.nps}   trend={4}   icon={TrendingUp}  color="green" />
        <StatCard label="Avg Wellness Score"  value={`${enriched.avgWellnessScore}%`} trend={3} icon={Activity} color="blue" />
        <StatCard label="Assessments Today"   value={enriched.assessmentsToday} trend={22} icon={TrendingUp} color="violet" />
        <StatCard label="Churn Rate"          value={`${enriched.churnRate}%`}  trend={-1} icon={ArrowDownRight} color={enriched.churnRate > 5 ? 'red' : 'green'} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue + tenant growth */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-1">Revenue & Growth</h3>
          <p className="text-xs text-gray-400 mb-5">Monthly recurring revenue (₹) over 6 months</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={enriched.monthlyData}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={v => [`₹${(v/1000).toFixed(0)}K`, 'MRR']} />
              <Area type="monotone" dataKey="mrr" stroke="#7c3aed" strokeWidth={2} fill="url(#mrrGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk distribution */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-1">Wellness Risk Spread</h3>
          <p className="text-xs text-gray-400 mb-5">Across all employees</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={enriched.riskDist} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {enriched.riskDist.map((_, i) => (
                  <Cell key={i} fill={['#6d28d9','#f59e0b','#f97316','#ef4444'][i]} />
                ))}
              </Pie>
              <Tooltip formatter={v => [`${v}%`]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Client health table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Client Health Overview</h3>
            <p className="text-xs text-gray-400 mt-0.5">Top organisations by employee count</p>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-100">
              <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Organisation</th>
              <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Employees</th>
              <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Wellness</th>
              <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Alerts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {enriched.topTenants.map((t, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="py-3.5 text-sm font-medium text-gray-800">{t.name}</td>
                <td className="py-3.5 text-sm text-gray-600 text-right">{t.employees.toLocaleString()}</td>
                <td className="py-3.5 text-right">
                  <span className={`text-sm font-semibold ${t.wellness >= 70 ? 'text-green-600' : t.wellness >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {t.wellness}%
                  </span>
                </td>
                <td className="py-3.5 text-right">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                    ${t.alerts === 0 ? 'bg-green-100 text-green-700' : t.alerts <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {t.alerts}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CEODashboard
