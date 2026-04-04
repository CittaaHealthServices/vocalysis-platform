/**
 * HR ROI Dashboard — Closed-Loop Outcome Measurement
 *
 * Shows the business value of Vocalysis:
 *  • Score improvement over 30 / 60 / 90 days
 *  • Employee improvement / stable / declined breakdown
 *  • Follow-up response rates and outcomes (better / same / harder)
 *  • 30-day rolling wellness trend sparkline
 *  • Intervention effectiveness by dimension
 *  • Consultation quality metrics
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, Users, MessageCircle,
  CheckCircle, BarChart2, Award, AlertCircle, RefreshCw,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { useApi } from '../../hooks/useApi'
import { Card } from '../../components/ui'
import api from '../../services/api'

// ─── helpers ─────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
]

const clamp = v => Math.min(100, Math.max(0, v ?? 0))

const StatCard = ({ icon: Icon, label, value, sub, color = 'text-cittaa-700', bg = 'bg-cittaa-50' }) => (
  <Card className="p-5 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${bg}`}>
      <Icon size={22} className={color} />
    </div>
    <div>
      <div className={`text-2xl font-bold ${color}`}>{value ?? '—'}</div>
      <div className="text-sm text-gray-500 leading-tight">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  </Card>
)

const ProgressBar = ({ value, color = 'bg-green-500', label, pct }) => (
  <div className="mb-2">
    <div className="flex justify-between text-xs text-gray-500 mb-1">
      <span>{label}</span>
      <span className="font-medium">{pct ?? `${value}%`}</span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${clamp(value)}%` }} />
    </div>
  </div>
)

// Custom tooltip for line chart
const WellnessTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs">
      <div className="font-semibold text-gray-700 mb-1">{label}</div>
      <div className="text-cittaa-600">Avg Score: <strong>{payload[0]?.value}</strong></div>
      <div className="text-gray-400">Sessions: {payload[0]?.payload?.sessions}</div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export const ROIDashboard = () => {
  const [period, setPeriod] = useState(90)

  const {
    data: roiResp,
    isLoading,
    isError,
    refetch,
  } = useApi(
    ['outcomes', 'roi', period],
    () => api.get(`/outcomes/roi?days=${period}`),
    { retry: 1, staleTime: 60_000 }
  )

  const {
    data: effectResp,
    isLoading: loadingEffect,
  } = useApi(
    ['outcomes', 'intervention-effectiveness'],
    () => api.get('/outcomes/intervention-effectiveness'),
    { retry: 1, staleTime: 120_000 }
  )

  const roi        = roiResp || {}
  const score      = roi.scoreImprovement     || {}
  const engagement = roi.followUpEngagement   || {}
  const trend      = roi.wellnessTrend30Days  || []
  const quality    = roi.consultationQuality  || {}
  const effect     = effectResp?.effectiveness || []

  // Format trend data for recharts
  const trendData = trend.map(t => ({
    date:     t.date?.slice(5) || '',   // MM-DD
    score:    t.avgScore,
    sessions: t.sessions,
  }))

  // Format effectiveness data for bar chart (top 5)
  const effectData = effect.slice(0, 6).map(e => ({
    name:       e.dimension?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown',
    better:     e.betterRate,
    same:       e.sameRate,
    harder:     e.harderRate,
  }))

  const avgChange    = score.avgScoreChange ?? 0
  const improvRate   = score.improvementRate ?? 0
  const responseRate = engagement.responseRate ?? 0
  const betterRate   = engagement.betterRate ?? 0

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-app">ROI Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Measuring the real-world impact of wellness interventions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setPeriod(opt.days)}
                className={`px-3 py-1.5 transition-colors ${
                  period === opt.days
                    ? 'bg-cittaa-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={refetch}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <AlertCircle size={16} />
          Could not load ROI data. Showing last available results.
        </div>
      )}

      {/* ── KPI row ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={period}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            icon={avgChange >= 0 ? TrendingUp : TrendingDown}
            label="Avg Score Change"
            value={avgChange >= 0 ? `+${avgChange}` : `${avgChange}`}
            sub={`over ${period} days`}
            color={avgChange >= 0 ? 'text-green-600' : 'text-red-500'}
            bg={avgChange >= 0 ? 'bg-green-50' : 'bg-red-50'}
          />
          <StatCard
            icon={Users}
            label="Improvement Rate"
            value={`${improvRate}%`}
            sub={`${score.improved ?? 0} of ${score.totalEmployeesTracked ?? 0} employees`}
            color="text-cittaa-700"
            bg="bg-cittaa-50"
          />
          <StatCard
            icon={MessageCircle}
            label="Follow-up Response Rate"
            value={`${responseRate}%`}
            sub={`${engagement.totalResponded ?? 0} of ${engagement.totalSent ?? 0} responded`}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <StatCard
            icon={CheckCircle}
            label="Feeling Better Rate"
            value={`${betterRate}%`}
            sub="of follow-up respondents"
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
        </motion.div>
      </AnimatePresence>

      {/* ── Employee outcome breakdown + Follow-up outcomes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Employee trajectory */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-1">Employee Wellness Trajectory</h3>
          <p className="text-xs text-gray-400 mb-5">Score change ≥ 3 points considered significant</p>

          {isLoading ? (
            <div className="h-28 flex items-center justify-center text-gray-300 text-sm">Loading…</div>
          ) : (
            <>
              <ProgressBar
                value={score.totalEmployeesTracked ? score.improved / score.totalEmployeesTracked * 100 : 0}
                color="bg-green-500"
                label="Improved"
                pct={`${score.improved ?? 0} employees`}
              />
              <ProgressBar
                value={score.totalEmployeesTracked ? (score.stable ?? 0) / score.totalEmployeesTracked * 100 : 0}
                color="bg-amber-400"
                label="Stable"
                pct={`${score.stable ?? 0} employees`}
              />
              <ProgressBar
                value={score.totalEmployeesTracked ? (score.declined ?? 0) / score.totalEmployeesTracked * 100 : 0}
                color="bg-red-400"
                label="Declined"
                pct={`${score.declined ?? 0} employees`}
              />

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                <Award size={16} className="text-green-500" />
                <span>
                  <strong>{score.employeesMovedToGreen ?? 0}</strong> employees moved from high-risk → green
                </span>
              </div>
            </>
          )}
        </Card>

        {/* Follow-up self-report outcomes */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-1">Follow-Up Self-Reports</h3>
          <p className="text-xs text-gray-400 mb-5">3-day post-session check-ins</p>

          {isLoading ? (
            <div className="h-28 flex items-center justify-center text-gray-300 text-sm">Loading…</div>
          ) : (
            <>
              <ProgressBar
                value={engagement.totalResponded ? (engagement.outcomes?.better ?? 0) / engagement.totalResponded * 100 : 0}
                color="bg-green-500"
                label="Feeling Better"
                pct={`${engagement.outcomes?.better ?? 0}`}
              />
              <ProgressBar
                value={engagement.totalResponded ? (engagement.outcomes?.same ?? 0) / engagement.totalResponded * 100 : 0}
                color="bg-amber-400"
                label="About the Same"
                pct={`${engagement.outcomes?.same ?? 0}`}
              />
              <ProgressBar
                value={engagement.totalResponded ? (engagement.outcomes?.harder ?? 0) / engagement.totalResponded * 100 : 0}
                color="bg-red-400"
                label="Finding It Harder"
                pct={`${engagement.outcomes?.harder ?? 0}`}
              />

              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-cittaa-700">{engagement.totalSent ?? 0}</div>
                  <div className="text-xs text-gray-400">Pings Sent</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600">{responseRate}%</div>
                  <div className="text-xs text-gray-400">Response Rate</div>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── 30-day wellness trend line ── */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-app mb-1">30-Day Wellness Trend</h3>
        <p className="text-xs text-gray-400 mb-4">Daily average wellness score across all check-ins</p>

        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Loading…</div>
        ) : trendData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-gray-300">
            <BarChart2 size={28} className="mb-2" />
            <span className="text-sm">No sessions in the last 30 days</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<WellnessTip />} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6d28d9"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Intervention effectiveness + Consultation quality ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Intervention effectiveness bar chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-1">Intervention Effectiveness</h3>
          <p className="text-xs text-gray-400 mb-4">
            % of follow-ups reporting "Better" by dominant dimension
          </p>

          {loadingEffect ? (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Loading…</div>
          ) : effectData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-300">
              <BarChart2 size={28} className="mb-2" />
              <span className="text-sm">No outcome data yet</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={effectData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#4b5563' }} width={60} />
                <Tooltip
                  formatter={(v, n) => [`${v}%`, n.charAt(0).toUpperCase() + n.slice(1)]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="better" name="Better" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="same"   name="Same"   stackId="a" fill="#f59e0b" />
                <Bar dataKey="harder" name="Harder" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Consultation quality */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-app mb-1">Consultation Quality</h3>
          <p className="text-xs text-gray-400 mb-5">Psychologist-submitted outcome forms (1–5 scale)</p>

          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Loading…</div>
          ) : quality.totalOutcomesRecorded === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-300">
              <CheckCircle size={28} className="mb-2" />
              <span className="text-sm">No outcome forms submitted yet</span>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Goals achieved gauge */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Avg Goals Achieved</span>
                  <span className="font-semibold text-cittaa-700">
                    {quality.avgGoalsAchieved ?? '—'} / 5
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cittaa-500 rounded-full transition-all duration-700"
                    style={{ width: `${(quality.avgGoalsAchieved ?? 0) / 5 * 100}%` }}
                  />
                </div>
              </div>

              {/* Patient engagement gauge */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Avg Patient Engagement</span>
                  <span className="font-semibold text-blue-600">
                    {quality.avgEngagement ?? '—'} / 5
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-700"
                    style={{ width: `${(quality.avgEngagement ?? 0) / 5 * 100}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-app">{quality.totalOutcomesRecorded}</div>
                  <div className="text-xs text-gray-400">Outcomes Recorded</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-500">{quality.followUpRecommended ?? 0}</div>
                  <div className="text-xs text-gray-400">Follow-ups Recommended</div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default ROIDashboard
