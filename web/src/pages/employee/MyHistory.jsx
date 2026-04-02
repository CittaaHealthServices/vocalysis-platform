/**
 * MyHistory — Employee Personal VocoScale™ Journey
 * Shows the employee's PHQ-9 / GAD-7 / PSS-10 progress, burnout risk,
 * wellness trend, and personalised micro-interventions.
 */
import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import api from '../../services/api'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Brain, TrendingUp, TrendingDown, Heart,
  Activity, CheckCircle2, Info, AlertTriangle, ChevronDown, Flame,
} from 'lucide-react'

const WELL_COLOR = '#10b981'
const DEP_COLOR  = '#7c3aed'
const ANX_COLOR  = '#f59e0b'
const STR_COLOR  = '#ef4444'
const BRN_COLOR  = '#6366f1'

const TIER_BG = {
  minimal:           'bg-green-100 text-green-700',
  mild:              'bg-lime-100 text-lime-700',
  moderate:          'bg-amber-100 text-amber-700',
  moderately_severe: 'bg-orange-100 text-orange-700',
  severe:            'bg-red-100 text-red-700',
  low_stress:        'bg-green-100 text-green-700',
  moderate_stress:   'bg-amber-100 text-amber-700',
  high_stress:       'bg-red-100 text-red-700',
}

const WELLNESS_LEVEL_STYLE = {
  thriving:  { bg: 'from-emerald-500 to-teal-600',  emoji: '🌟', label: 'Thriving'      },
  healthy:   { bg: 'from-blue-500 to-indigo-600',   emoji: '😊', label: 'Healthy'       },
  at_risk:   { bg: 'from-amber-500 to-orange-600',  emoji: '⚠️', label: 'At Risk'       },
  in_crisis: { bg: 'from-red-500 to-rose-700',      emoji: '💙', label: 'Needs Support' },
}

const INTERVENTIONS = {
  phq9: {
    mild:              { title: 'Mood Lift Activity',     desc: 'Schedule one enjoyable activity today — even 15 minutes of something you love can lift mood significantly.', icon: '🎯', color: 'bg-lime-50 border-lime-200 text-lime-800' },
    moderate:          { title: 'Behavioural Activation', desc: 'Start a simple daily routine with small achievable tasks. Contact a trusted friend or colleague for a chat.', icon: '📋', color: 'bg-amber-50 border-amber-200 text-amber-800' },
    moderately_severe: { title: 'Speak to a Counsellor', desc: 'Your results suggest clinical-level depression markers. Please book a consultation — your psychologist is here for you.', icon: '💬', color: 'bg-orange-50 border-orange-200 text-orange-800' },
    severe:            { title: 'Urgent Support',         desc: 'Your results indicate severe depression markers. Please use the SOS button or contact your assigned psychologist immediately.', icon: '🚨', color: 'bg-red-50 border-red-300 text-red-800' },
  },
  gad7: {
    mild:              { title: '4-7-8 Breathing',          desc: 'Inhale for 4 counts, hold for 7, exhale for 8. Repeat 4 times. This activates the parasympathetic nervous system.', icon: '🫁', color: 'bg-sky-50 border-sky-200 text-sky-800' },
    moderate:          { title: 'Progressive Muscle Relax', desc: 'Tense each muscle group for 5 seconds then release, starting from feet up to face. Do this twice daily.', icon: '🧘', color: 'bg-amber-50 border-amber-200 text-amber-800' },
    severe:            { title: 'Grounding Technique',      desc: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. Then contact your psychologist.', icon: '🌿', color: 'bg-orange-50 border-orange-200 text-orange-800' },
  },
  pss10: {
    moderate_stress:   { title: 'Stress Diary',    desc: 'Write down 3 things that stressed you today and one small thing you can control about each. Review at week end.', icon: '📔', color: 'bg-sky-50 border-sky-200 text-sky-800' },
    high_stress:       { title: 'Workload Review', desc: 'Discuss your current workload with your manager. Removing 1–2 low-priority tasks can significantly reduce stress.', icon: '⚖️', color: 'bg-orange-50 border-orange-200 text-orange-800' },
  },
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-3 text-sm">
      <p className="font-semibold text-gray-600 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(0) : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function ScaleCard({ label, score, maxScore, tier, color }) {
  const pct = score != null ? Math.round((score / maxScore) * 100) : 0
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-extrabold" style={{ color: score != null ? color : '#d1d5db' }}>
          {score ?? '—'}
        </span>
        <span className="text-sm text-gray-400 pb-1">/ {maxScore}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }} />
      </div>
      {tier && (
        <span className={`self-start text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${TIER_BG[tier] || 'bg-gray-100 text-gray-600'}`}>
          {tier.replace(/_/g, ' ')}
        </span>
      )}
    </div>
  )
}

function InterventionTip({ tip }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      className={`border rounded-2xl p-4 cursor-pointer select-none ${tip.color}`}
      whileHover={{ scale: 1.01 }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{tip.icon}</span>
          <span className="font-bold text-sm">{tip.title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 text-sm leading-relaxed"
          >
            {tip.desc}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export const MyHistory = () => {
  const [period, setPeriod] = useState('12')

  const { data: vResp, isLoading } = useApi(
    ['my', 'vocoscale', period],
    () => api.get(`/my/vocoscale?weeks=${period}`),
    { retry: 1, staleTime: 60_000 }
  )

  const d = vResp?.data
  const history       = d?.history || []
  const latest        = d?.latest
  const wellnessDelta = d?.wellnessDelta

  if (isLoading) return <LoadingScreen />

  const levelStyle = WELLNESS_LEVEL_STYLE[latest?.wellnessLevel] || WELLNESS_LEVEL_STYLE.healthy

  const tips = []
  if (latest?.phq9Tier  && INTERVENTIONS.phq9[latest.phq9Tier])   tips.push(INTERVENTIONS.phq9[latest.phq9Tier])
  if (latest?.gad7Tier  && INTERVENTIONS.gad7[latest.gad7Tier])   tips.push(INTERVENTIONS.gad7[latest.gad7Tier])
  if (latest?.pss10Tier && INTERVENTIONS.pss10[latest.pss10Tier]) tips.push(INTERVENTIONS.pss10[latest.pss10Tier])

  const chartData = history.map(h => ({
    label:    h.date ? format(new Date(h.date), 'dd MMM') : '',
    wellness: h.wellness,
    phq9:     h.phq9,
    gad7:     h.gad7,
    pss10:    h.pss10,
    burnout:  h.burnout,
  }))

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-app flex items-center gap-2">
            <Brain className="w-7 h-7 text-violet-600" /> My Wellness Journey
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Powered by <span className="font-semibold text-violet-700">VocoScale™</span> — PHQ-9 · GAD-7 · PSS-10
          </p>
        </div>
        <div className="flex gap-2">
          {[{ l: '4w', v: '4' }, { l: '8w', v: '8' }, { l: '12w', v: '12' }, { l: '24w', v: '24' }].map(o => (
            <button key={o.v} onClick={() => setPeriod(o.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === o.v ? 'bg-violet-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{o.l}</button>
          ))}
        </div>
      </div>

      {history.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-violet-400" />
          </div>
          <h3 className="font-bold text-xl text-app mb-2">No check-ins yet</h3>
          <p className="text-gray-400 text-sm mb-6">Complete your first voice wellness check-in to start your journey.</p>
          <a href="/my/check-in"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors text-sm">
            Start Check-in
          </a>
        </Card>
      ) : (
        <>
          {/* Hero card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-br ${levelStyle.bg} rounded-3xl p-6 text-white shadow-xl`}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-white/70 font-medium mb-1">Current Wellness Score</p>
                <p className="text-6xl font-extrabold">{latest?.wellness ?? '—'}</p>
                <p className="text-sm text-white/70 mt-1">out of 100</p>
              </div>
              <div className="text-right">
                <p className="text-4xl mb-1">{levelStyle.emoji}</p>
                <p className="text-xl font-bold">{levelStyle.label}</p>
                {wellnessDelta != null && (
                  <p className="text-sm mt-1 text-white/80 flex items-center gap-1 justify-end">
                    {wellnessDelta >= 0
                      ? <TrendingUp className="w-4 h-4" />
                      : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(wellnessDelta)} pts vs last session
                  </p>
                )}
              </div>
            </div>
            {latest?.clinicalFlag === 'urgent_review' && (
              <div className="mt-4 bg-white/20 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Your results suggest speaking with a psychologist would be helpful soon.
              </div>
            )}
          </motion.div>

          {/* VocoScale™ score cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScaleCard label="PHQ-9"  score={latest?.phq9}  maxScore={27} tier={latest?.phq9Tier}  color={DEP_COLOR} />
            <ScaleCard label="GAD-7"  score={latest?.gad7}  maxScore={21} tier={latest?.gad7Tier}  color={ANX_COLOR} />
            <ScaleCard label="PSS-10" score={latest?.pss10} maxScore={40} tier={latest?.pss10Tier} color={STR_COLOR} />
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Burnout Risk</span>
              </div>
              <span className="text-4xl font-extrabold" style={{ color: latest?.burnout != null ? BRN_COLOR : '#d1d5db' }}>
                {latest?.burnout ?? '—'}
              </span>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: BRN_COLOR }}
                  initial={{ width: 0 }} animate={{ width: `${latest?.burnout ?? 0}%` }}
                  transition={{ duration: 1, delay: 0.4 }} />
              </div>
              <span className="text-xs text-gray-400">/ 100</span>
            </div>
          </div>

          {/* VocoScale™ trend chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-app mb-1">VocoScale™ Progress</h3>
            <p className="text-xs text-gray-400 mb-4">Lower scores = better — PHQ-9 · GAD-7 · PSS-10</p>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="phq9"  name="PHQ-9"  stroke={DEP_COLOR} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="gad7"  name="GAD-7"  stroke={ANX_COLOR} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="pss10" name="PSS-10" stroke={STR_COLOR} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 text-center py-8">Need 2+ check-ins to show a trend.</p>}
          </Card>

          {/* Wellness area chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-app mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-emerald-500" /> Wellness Score Over Time
            </h3>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="wellGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={WELL_COLOR} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={WELL_COLOR} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="wellness" name="Wellness"
                    stroke={WELL_COLOR} fill="url(#wellGrad)" strokeWidth={2.5}
                    dot={{ r: 4, fill: WELL_COLOR }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 text-center py-6">Complete more check-ins to see your trend.</p>}
          </Card>

          {/* Dimension bars */}
          {latest && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-app mb-4">Latest Dimension Snapshot</h3>
              <div className="space-y-3">
                {[
                  { label: 'Depression', value: latest.depression, color: DEP_COLOR },
                  { label: 'Anxiety',    value: latest.anxiety,    color: ANX_COLOR },
                  { label: 'Stress',     value: latest.stress,     color: STR_COLOR },
                  { label: 'Burnout',    value: latest.burnout,    color: BRN_COLOR },
                ].map(dim => (
                  <div key={dim.label} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600 w-20 shrink-0">{dim.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: dim.color }}
                        initial={{ width: 0 }} animate={{ width: `${dim.value ?? 0}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }} />
                    </div>
                    <span className="text-sm font-bold w-8 text-right" style={{ color: dim.color }}>
                      {dim.value ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Micro-interventions */}
          {tips.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-app flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-violet-500" /> Personalised Wellness Tips
              </h3>
              {tips.map((tip, i) => <InterventionTip key={i} tip={tip} />)}
            </div>
          )}

          {/* Session log */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-app mb-4">Session History</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {[...history].reverse().map((h, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <span className="text-xl shrink-0">
                    {h.wellnessLevel === 'thriving' ? '🌟' : h.wellnessLevel === 'healthy' ? '😊' : h.wellnessLevel === 'at_risk' ? '⚠️' : '💙'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-app truncate">
                      {h.date ? format(new Date(h.date), 'EEEE, dd MMM yyyy') : '—'}
                    </p>
                    <p className="text-xs text-gray-400">
                      PHQ-9: {h.phq9 ?? '—'} · GAD-7: {h.gad7 ?? '—'} · PSS-10: {h.pss10 ?? '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-extrabold" style={{ color: WELL_COLOR }}>{h.wellness ?? '—'}</span>
                    <p className="text-xs text-gray-400 capitalize">{h.wellnessLevel?.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* VocoScale disclaimer */}
          <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-300" />
            <p>
              VocoScale™ scores are acoustic-derived approximations of PHQ-9, GAD-7 and PSS-10 validated scales.
              Indicative only — must be confirmed by a licensed clinician before any diagnostic or treatment decisions.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default MyHistory
