import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import api from '../../services/api'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { Brain, Activity, TrendingUp, AlertTriangle, Users, ShieldAlert } from 'lucide-react'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45 } } }

// ── Colour palettes ───────────────────────────────────────────────────────────
const DEP_COLOR   = '#7c3aed'   // purple
const ANX_COLOR   = '#f59e0b'   // amber
const STR_COLOR   = '#ef4444'   // red
const WELL_COLOR  = '#10b981'   // green
const PHQ9_COLOR  = '#8b5cf6'
const GAD7_COLOR  = '#f97316'
const PSS10_COLOR = '#3b82f6'

const RISK_COLORS = {
  red:    '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green:  '#22c55e',
}

// PHQ-9 / GAD-7 / PSS-10 tier colours
const TIER_COLORS = {
  minimal:           '#22c55e',
  mild:              '#a3e635',
  moderate:          '#f59e0b',
  moderately_severe: '#f97316',
  severe:            '#ef4444',
  low_stress:        '#22c55e',
  moderate_stress:   '#f59e0b',
  high_stress:       '#ef4444',
}

const TIER_LABELS = {
  minimal:           'Minimal',
  mild:              'Mild',
  moderate:          'Moderate',
  moderately_severe: 'Mod. Severe',
  severe:            'Severe',
  low_stress:        'Low',
  moderate_stress:   'Moderate',
  high_stress:       'High',
}

// ── Helper: empty placeholder ────────────────────────────────────────────────
const EmptyChart = ({ label }) => (
  <div className="flex flex-col items-center justify-center h-40 opacity-50">
    <Activity className="w-10 h-10 text-gray-300 mb-2" />
    <p className="text-sm text-gray-400">No data yet for {label}</p>
  </div>
)

// ── Scale badge ───────────────────────────────────────────────────────────────
const ScaleBadge = ({ label, score, max, tier, color }) => (
  <div className="flex flex-col items-center bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
    <span className="text-xs text-gray-500 font-medium mb-1">{label}</span>
    <span className="text-3xl font-extrabold" style={{ color }}>{score ?? '—'}</span>
    <span className="text-xs text-gray-400">/ {max}</span>
    {tier && (
      <span className="mt-2 text-xs px-2.5 py-0.5 rounded-full font-semibold text-white"
        style={{ background: TIER_COLORS[tier] || '#94a3b8' }}>
        {TIER_LABELS[tier] || tier}
      </span>
    )}
  </div>
)

// ── Custom tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export const ClinicalAnalytics = () => {
  const [period, setPeriod] = useState('12')
  const [activeTab, setActiveTab] = useState('overview')

  const { data: deepResp, isLoading } = useApi(
    ['analytics', 'clinical-deep', period],
    () => api.get(`/analytics/clinical-deep?weeks=${period}`),
    { retry: 1, staleTime: 60_000 }
  )

  const deep = deepResp?.data

  if (isLoading) return <LoadingScreen />

  const { summary, dimensionTrends = [], scaleDistributions = {}, riskDistribution = [], departmentHeatmap = [], atRiskEmployees = [] } = deep || {}

  // Recharts-friendly scale distributions
  const toDistArr = (raw) => (raw || []).map(d => ({
    name:  TIER_LABELS[d._id] || d._id || 'Unknown',
    count: d.count,
    tier:  d._id,
    fill:  TIER_COLORS[d._id] || '#94a3b8',
  }))

  const phq9Arr  = toDistArr(scaleDistributions.phq9)
  const gad7Arr  = toDistArr(scaleDistributions.gad7)
  const pss10Arr = toDistArr(scaleDistributions.pss10)

  const riskArr  = (riskDistribution || []).map(d => ({
    name:  (d._id || 'unknown').toUpperCase(),
    count: d.count,
    fill:  RISK_COLORS[d._id] || '#94a3b8',
  }))

  const heatArr = departmentHeatmap.map(d => ({
    dept:       d._id,
    dep:        Math.round(d.avgDep  || 0),
    anx:        Math.round(d.avgAnx  || 0),
    str:        Math.round(d.avgStr  || 0),
    wellness:   Math.round(d.avgWellness || 0),
    highRisk:   d.highRisk || 0,
    count:      d.count || 0,
  }))

  const trendArr = dimensionTrends.map(d => ({
    week:       d.week,
    label:      d.weekStart ? format(new Date(d.weekStart), 'dd MMM') : d.week,
    depression: d.depression,
    anxiety:    d.anxiety,
    stress:     d.stress,
    wellness:   d.wellness,
    phq9:       d.phq9,
    gad7:       d.gad7,
    pss10:      d.pss10,
  }))

  // Radar chart data for latest average snapshot
  const radarData = trendArr.length > 0 ? [
    { metric: 'Depression', value: trendArr.at(-1)?.depression || 0 },
    { metric: 'Anxiety',    value: trendArr.at(-1)?.anxiety    || 0 },
    { metric: 'Stress',     value: trendArr.at(-1)?.stress     || 0 },
    { metric: 'PHQ-9',      value: Math.round((trendArr.at(-1)?.phq9  || 0) * 100 / 27) },
    { metric: 'GAD-7',      value: Math.round((trendArr.at(-1)?.gad7  || 0) * 100 / 21) },
    { metric: 'PSS-10',     value: Math.round((trendArr.at(-1)?.pss10 || 0) * 100 / 40) },
  ] : []

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-app flex items-center gap-2">
            <Brain className="w-7 h-7 text-violet-600" />
            Clinical Analytics 🔬
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Powered by <span className="font-semibold text-violet-700">VocoScale™</span> — PHQ-9 · GAD-7 · PSS-10 acoustic derivation
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: '4 wks',  val: '4'  },
            { label: '8 wks',  val: '8'  },
            { label: '12 wks', val: '12' },
            { label: '24 wks', val: '24' },
          ].map(o => (
            <button
              key={o.val}
              onClick={() => setPeriod(o.val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === o.val
                  ? 'bg-violet-600 text-white shadow'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stat cards */}
      <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-4" variants={container} initial="hidden" animate="show">
        {[
          { label: 'Total Assessed',  value: summary?.totalAssessed ?? '—',         icon: Users,        bg: 'from-violet-500 to-violet-700' },
          { label: 'High / Crisis Risk', value: summary?.highRiskCount ?? '—',      icon: AlertTriangle, bg: 'from-red-500 to-red-700' },
          { label: 'At-Risk %',       value: summary?.highRiskPct ? `${summary.highRiskPct}%` : '—', icon: ShieldAlert, bg: 'from-orange-500 to-orange-700' },
          { label: 'Avg Wellness',    value: summary?.avgWellness ? `${summary.avgWellness}/100` : '—', icon: Activity, bg: 'from-emerald-500 to-emerald-700' },
        ].map(c => {
          const Icon = c.icon
          return (
            <motion.div key={c.label} variants={item}>
              <div className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-white/70 font-medium mb-1">{c.label}</p>
                    <p className="text-3xl font-extrabold">{c.value}</p>
                  </div>
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {[
          { id: 'overview',   label: '📊 Overview'   },
          { id: 'scales',     label: '🧠 VocoScale™' },
          { id: 'trends',     label: '📈 Trends'     },
          { id: 'heatmap',    label: '🏢 Departments'},
          { id: 'atrisk',     label: '🚨 At-Risk'    },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.id
                ? 'bg-white shadow text-violet-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6" variants={container} initial="hidden" animate="show">

          {/* Risk distribution pie */}
          <motion.div variants={item}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-4 flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-violet-500" /> Risk Level Distribution
              </h3>
              {riskArr.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={riskArr} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, count }) => `${name}: ${count}`}>
                      {riskArr.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="risk distribution" />}
            </Card>
          </motion.div>

          {/* Radar snapshot */}
          <motion.div variants={item}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-4 flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-amber-500" /> Latest Dimension Snapshot
              </h3>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="Score (0-100)" dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} />
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="dimension snapshot" />}
            </Card>
          </motion.div>

          {/* Wellness trend area chart */}
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-4 flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-emerald-500" /> Wellness & Dimension Trends
              </h3>
              {trendArr.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendArr} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="wellness"   name="Wellness"   stroke={WELL_COLOR} fill={WELL_COLOR}  fillOpacity={0.12} strokeWidth={2} />
                    <Area type="monotone" dataKey="depression" name="Depression" stroke={DEP_COLOR}  fill={DEP_COLOR}   fillOpacity={0.08} strokeWidth={1.5} />
                    <Area type="monotone" dataKey="anxiety"    name="Anxiety"    stroke={ANX_COLOR}  fill={ANX_COLOR}   fillOpacity={0.08} strokeWidth={1.5} />
                    <Area type="monotone" dataKey="stress"     name="Stress"     stroke={STR_COLOR}  fill={STR_COLOR}   fillOpacity={0.08} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="trend data" />}
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ── VOCOSCALE™ TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'scales' && (
        <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">

          {/* Scale description */}
          <motion.div variants={item}>
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm text-violet-800">
              <strong>VocoScale™</strong> derives PHQ-9, GAD-7 and PSS-10 equivalent scores acoustically using
              Cittaa's proprietary multi-path weighting model (acoustic signature β-coefficients + VocoCore™ ML scores).
              These are indicative approximations — a licensed clinician must confirm before clinical use.
            </div>
          </motion.div>

          {/* Three scale bar charts */}
          {[
            { key: 'phq9',  arr: phq9Arr,  title: 'PHQ-9 (Depression) — Patient Distribution', color: PHQ9_COLOR,
              tiers: ['minimal','mild','moderate','moderately_severe','severe'] },
            { key: 'gad7',  arr: gad7Arr,  title: 'GAD-7 (Anxiety) — Patient Distribution', color: GAD7_COLOR,
              tiers: ['minimal','mild','moderate','severe'] },
            { key: 'pss10', arr: pss10Arr, title: 'PSS-10 (Stress) — Patient Distribution', color: PSS10_COLOR,
              tiers: ['low_stress','moderate_stress','high_stress'] },
          ].map(({ key, arr, title, color, tiers }) => (
            <motion.div key={key} variants={item}>
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-app mb-1">{title}</h3>
                <p className="text-xs text-gray-400 mb-4">Count of employees per severity tier (last {period} weeks)</p>
                {arr.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={arr} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Employees" radius={[6, 6, 0, 0]}>
                        {arr.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart label={key.toUpperCase()} />}
              </Card>
            </motion.div>
          ))}

          {/* VocoScale trend line */}
          <motion.div variants={item}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-4">VocoScale™ Score Trends (weekly average)</h3>
              {trendArr.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendArr} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="phq9"  name="PHQ-9 avg"  stroke={PHQ9_COLOR}  strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="gad7"  name="GAD-7 avg"  stroke={GAD7_COLOR}  strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="pss10" name="PSS-10 avg" stroke={PSS10_COLOR} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="VocoScale trend" />}
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ── TRENDS TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'trends' && (
        <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
          <motion.div variants={item}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-4">Depression Trend (PHQ-9 acoustic equiv.)</h3>
              {trendArr.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendArr}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="depression" name="Dim Score (0-100)" stroke={DEP_COLOR} fill={DEP_COLOR} fillOpacity={0.15} strokeWidth={2} />
                    <Line type="monotone" dataKey="phq9" name="PHQ-9 equiv" stroke="#c026d3" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="depression trend" />}
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-4">Anxiety Trend (GAD-7 acoustic equiv.)</h3>
              {trendArr.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendArr}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="anxiety" name="Dim Score (0-100)" stroke={ANX_COLOR} fill={ANX_COLOR} fillOpacity={0.15} strokeWidth={2} />
                    <Line type="monotone" dataKey="gad7" name="GAD-7 equiv" stroke="#ea580c" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="anxiety trend" />}
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-4">Stress Trend (PSS-10 acoustic equiv.)</h3>
              {trendArr.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendArr}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="stress" name="Dim Score (0-100)" stroke={STR_COLOR} fill={STR_COLOR} fillOpacity={0.15} strokeWidth={2} />
                    <Line type="monotone" dataKey="pss10" name="PSS-10 equiv" stroke="#1d4ed8" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="stress trend" />}
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ── DEPARTMENTS HEATMAP TAB ───────────────────────────────────────────── */}
      {activeTab === 'heatmap' && (
        <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
          <motion.div variants={item}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-4">Department-Wise Mental Health Heatmap</h3>
              {heatArr.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={heatArr} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="dept" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Bar dataKey="dep"      name="Depression" fill={DEP_COLOR}  radius={[0, 4, 4, 0]} />
                      <Bar dataKey="anx"      name="Anxiety"    fill={ANX_COLOR}  radius={[0, 4, 4, 0]} />
                      <Bar dataKey="str"      name="Stress"     fill={STR_COLOR}  radius={[0, 4, 4, 0]} />
                      <Bar dataKey="wellness" name="Wellness"   fill={WELL_COLOR} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Table view */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b">
                          <th className="text-left py-2 font-semibold">Department</th>
                          <th className="text-center py-2">Sessions</th>
                          <th className="text-center py-2" style={{ color: DEP_COLOR }}>Dep</th>
                          <th className="text-center py-2" style={{ color: ANX_COLOR }}>Anx</th>
                          <th className="text-center py-2" style={{ color: STR_COLOR }}>Str</th>
                          <th className="text-center py-2" style={{ color: WELL_COLOR }}>Wellness</th>
                          <th className="text-center py-2 text-red-500">High Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatArr.map((d, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="py-2 font-medium text-app">{d.dept}</td>
                            <td className="py-2 text-center text-gray-500">{d.count}</td>
                            <td className="py-2 text-center font-mono" style={{ color: DEP_COLOR }}>{d.dep}</td>
                            <td className="py-2 text-center font-mono" style={{ color: ANX_COLOR }}>{d.anx}</td>
                            <td className="py-2 text-center font-mono" style={{ color: STR_COLOR }}>{d.str}</td>
                            <td className="py-2 text-center font-mono" style={{ color: WELL_COLOR }}>{d.wellness}</td>
                            <td className="py-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.highRisk > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {d.highRisk}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : <EmptyChart label="department data" />}
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ── AT-RISK EMPLOYEES TAB ─────────────────────────────────────────────── */}
      {activeTab === 'atrisk' && (
        <motion.div className="space-y-4" variants={container} initial="hidden" animate="show">
          <motion.div variants={item}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-1 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> At-Risk Employee Registry
              </h3>
              <p className="text-xs text-gray-400 mb-4">Employees with high or critical risk in their latest session</p>
              {atRiskEmployees.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b">
                        <th className="text-left py-2 font-semibold">Employee</th>
                        <th className="text-left py-2">Dept</th>
                        <th className="text-center py-2">Risk</th>
                        <th className="text-center py-2" style={{ color: DEP_COLOR }}>Dep</th>
                        <th className="text-center py-2" style={{ color: ANX_COLOR }}>Anx</th>
                        <th className="text-center py-2" style={{ color: STR_COLOR }}>Str</th>
                        <th className="text-center py-2" style={{ color: PHQ9_COLOR }}>PHQ-9</th>
                        <th className="text-center py-2" style={{ color: GAD7_COLOR }}>GAD-7</th>
                        <th className="text-center py-2" style={{ color: PSS10_COLOR }}>PSS-10</th>
                        <th className="text-center py-2">Sessions</th>
                        <th className="text-center py-2">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atRiskEmployees.map((e, i) => (
                        <tr key={i} className="border-b hover:bg-red-50/40 transition-colors">
                          <td className="py-2.5">
                            <p className="font-semibold text-app">{e.name || 'Anonymous'}</p>
                            <p className="text-xs text-gray-400">{e.email || '—'}</p>
                          </td>
                          <td className="py-2.5 text-gray-500 text-xs">{e.department || '—'}</td>
                          <td className="py-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white capitalize"
                              style={{ background: RISK_COLORS[e.latestRisk] || '#94a3b8' }}>
                              {e.latestRisk || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 text-center font-mono text-sm" style={{ color: DEP_COLOR }}>{e.latestDep ?? '—'}</td>
                          <td className="py-2.5 text-center font-mono text-sm" style={{ color: ANX_COLOR }}>{e.latestAnx ?? '—'}</td>
                          <td className="py-2.5 text-center font-mono text-sm" style={{ color: STR_COLOR }}>{e.latestStr ?? '—'}</td>
                          <td className="py-2.5 text-center font-mono text-sm" style={{ color: PHQ9_COLOR }}>{e.latestPHQ9 ?? '—'}</td>
                          <td className="py-2.5 text-center font-mono text-sm" style={{ color: GAD7_COLOR }}>{e.latestGAD7 ?? '—'}</td>
                          <td className="py-2.5 text-center font-mono text-sm" style={{ color: PSS10_COLOR }}>{e.latestPSS10 ?? '—'}</td>
                          <td className="py-2.5 text-center text-gray-500">{e.sessionCount}</td>
                          <td className="py-2.5 text-center text-xs text-gray-400">
                            {e.lastSeen ? format(new Date(e.lastSeen), 'dd MMM') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-7 h-7 text-green-400" />
                  </div>
                  <p className="text-gray-400 font-medium">No high-risk employees at this time</p>
                  <p className="text-gray-300 text-sm mt-1">All employees are within wellness range</p>
                </div>
              )}
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default ClinicalAnalytics
