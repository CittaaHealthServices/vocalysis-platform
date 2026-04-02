/**
 * CEODashboard — fully dynamic, zero hardcoded values.
 * Calls /cittaa-admin/overview which returns aggregated real data.
 */
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import {
  TrendingUp, Users, Building2, Activity, AlertCircle,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

const RISK_COLORS = ['#6d28d9', '#f59e0b', '#f97316', '#ef4444']

// ── helper components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, trend, icon: Icon, color = 'violet' }) {
  const colorMap = {
    violet: { bg: '#f5f3ff', icon: '#7c3aed', val: '#4c1d95' },
    green:  { bg: '#f0fdf4', icon: '#16a34a', val: '#14532d' },
    red:    { bg: '#fff1f2', icon: '#dc2626', val: '#7f1d1d' },
    blue:   { bg: '#eff6ff', icon: '#2563eb', val: '#1e3a5f' },
    amber:  { bg: '#fffbeb', icon: '#d97706', val: '#92400e' },
  }
  const c         = colorMap[color] || colorMap.violet
  const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus
  const trendClr  = trend > 0 ? '#16a34a'   : trend < 0 ? '#dc2626'      : '#9ca3af'

  return (
    <div className="rounded-2xl p-6 border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="rounded-xl p-2.5" style={{ background: c.bg }}>
          <Icon className="w-5 h-5" style={{ color: c.icon }} />
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: trendClr }}>
            <TrendIcon className="w-3.5 h-3.5" />
            {Math.abs(trend)}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold mb-1" style={{ color: c.val }}>
        {value ?? '—'}
      </div>
      <div className="text-sm text-gray-500 font-medium">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

const EmptyChart = ({ msg = 'No data yet' }) => (
  <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-2">
    <Activity className="w-8 h-8" />
    <span className="text-sm">{msg}</span>
  </div>
)

// ── main ─────────────────────────────────────────────────────────────────────

export const CEODashboard = () => {
  const { user } = useAuth()

  const { data, isLoading, isError, refetch } = useApi(
    ['ceo', 'overview'],
    // axios interceptor already returns response.data, so r = { success, data: {...} }
    () => api.get('/cittaa-admin/overview').then(r => r.data),
    { retry: 1, staleTime: 60_000 },
  )

  if (isLoading) return <LoadingScreen />

  const d = data || {}

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Executive Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Live platform intelligence · Vocalysis 2.0
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {isError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          Could not reach the API — showing last known data.
        </div>
      )}

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Clients"
          value={d.activeTenants ?? '—'}
          sub={`${d.totalTenants ?? 0} total organisations`}
          icon={Building2}
          color="violet"
        />
        <StatCard
          label="Employees Served"
          value={d.totalEmployees != null ? d.totalEmployees.toLocaleString() : '—'}
          sub="active across all orgs"
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Assessments Today"
          value={d.assessmentsToday ?? '—'}
          sub={`${d.assessmentsThisMonth ?? 0} this month`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Active Alerts"
          value={d.activeAlerts ?? '—'}
          sub="requiring review"
          icon={AlertCircle}
          color={d.activeAlerts > 10 ? 'red' : 'amber'}
        />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Avg Wellness Score"
          value={d.avgWellnessScore != null ? `${d.avgWellnessScore}` : '—'}
          sub="platform-wide average"
          icon={Activity}
          color="green"
        />
        <StatCard
          label="Total Assessments"
          value={d.totalAssessmentsEver != null ? d.totalAssessmentsEver.toLocaleString() : '—'}
          sub="all time"
          icon={TrendingUp}
          color="violet"
        />
        <StatCard
          label="Active API Keys"
          value={d.activeApiKeys ?? '—'}
          sub="live integrations"
          icon={Building2}
          color="blue"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly assessment trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-1">Assessment Volume</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly completed check-ins (last 6 months)</p>
          {d.monthlyData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={d.monthlyData}>
                <defs>
                  <linearGradient id="assessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip
                  formatter={(v, n) => [v, n === 'assessments' ? 'Assessments' : 'Avg Score']}
                  contentStyle={{ borderRadius: 10, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="assessments" stroke="#7c3aed" strokeWidth={2} fill="url(#assessGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart msg="No assessment data yet — check-ins will appear here" />
          )}
        </div>

        {/* Risk distribution */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-1">Wellness Risk Spread</h3>
          <p className="text-xs text-gray-400 mb-4">Across all completed assessments</p>
          {d.riskDist?.some(r => r.value > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={d.riskDist}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={76}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {d.riskDist.map((_, i) => (
                    <Cell key={i} fill={RISK_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => [v, 'Sessions']} contentStyle={{ fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart msg="No completed assessments yet" />
          )}
        </div>
      </div>

      {/* Client health table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-1">Client Health Overview</h3>
        <p className="text-xs text-gray-400 mb-5">All organisations — sorted by employee count</p>

        {d.topTenants?.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Organisation</th>
                <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Employees</th>
                <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Sessions</th>
                <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Avg Wellness</th>
                <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Alerts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {d.topTenants.map((t, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3.5 text-sm font-medium text-gray-800">{t.name}</td>
                  <td className="py-3.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      t.status === 'active' ? 'bg-green-100 text-green-700'
                      : t.status === 'trial' ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-sm text-gray-600 text-right">{t.employees.toLocaleString()}</td>
                  <td className="py-3.5 text-sm text-gray-600 text-right">{t.sessions}</td>
                  <td className="py-3.5 text-right">
                    <span className={`text-sm font-semibold ${
                      t.wellness === 0 ? 'text-gray-400'
                      : t.wellness >= 70 ? 'text-green-600'
                      : t.wellness >= 55 ? 'text-yellow-600'
                      : 'text-red-500'
                    }`}>
                      {t.wellness === 0 ? '—' : `${t.wellness}%`}
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      t.alerts === 0 ? 'bg-green-100 text-green-700'
                      : t.alerts <= 2  ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      {t.alerts}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-10 text-gray-400 text-sm">
            No organisations onboarded yet
          </div>
        )}
      </div>
    </div>
  )
}

export default CEODashboard
