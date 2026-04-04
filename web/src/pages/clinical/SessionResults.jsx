import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, Badge, Button, Tabs, LoadingScreen } from '../../components/ui'
import { ScoreGauge } from '../../components/charts/ScoreGauge'
import { useForm } from 'react-hook-form'
import api from '../../services/api'
import toast from 'react-hot-toast'
import ConsultationBookingModal from '../../components/consultations/ConsultationBookingModal'

// ── Biomarker label map ────────────────────────────────────────────────────────
const BIOMARKER_LABELS = {
  pitch:             'Pitch Analysis',
  speech_rate:       'Speech Dynamics',
  vocal_quality:     'Vocal Quality',
  energy_level:      'Energy Profile',
  rhythm_stability:  'Rhythmic Pattern',
}

// Severity → badge variant mapping
function severityVariant(sev) {
  if (sev === 'high')     return 'danger'
  if (sev === 'moderate') return 'warning'
  return 'success'
}

// ── Trajectory chart colours ───────────────────────────────────────────────────
const LINE_COLORS = {
  depression: '#ef4444',
  anxiety:    '#f97316',
  stress:     '#eab308',
  wellness:   '#22c55e',
}

// ── Trend badge helper ────────────────────────────────────────────────────────
function TrendBadge({ trend }) {
  const map = {
    improving:          { label: '↑ Improving',            variant: 'success'  },
    stable:             { label: '→ Stable',               variant: 'info'     },
    deteriorating:      { label: '↓ Deteriorating',        variant: 'danger'   },
    insufficient_data:  { label: 'Insufficient data',      variant: 'neutral'  },
  }
  const { label, variant } = map[trend] || { label: trend, variant: 'neutral' }
  return <Badge variant={variant}>{label}</Badge>
}

// ── Custom chart tooltip ───────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">
        {new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
      </p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600 capitalize">{p.dataKey}:</span>
          <span className="font-medium">{p.value ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

export const SessionResults = () => {
  const { id } = useParams()
  const [consultationModalOpen, setConsultationModalOpen] = useState(false)
  const [activeLines, setActiveLines] = useState({ depression: true, anxiety: true, stress: true, wellness: true })

  const { data: session, isLoading } = useApi(
    ['session', id],
    () => api.get(`/sessions/${id}`)
  )

  const patientId = session?.patientId || session?.employeeId

  // Fetch trajectory once session (and its patientId) is available
  const { data: trajectory, isLoading: trajectoryLoading } = useApi(
    ['trajectory', patientId],
    () => api.get(`/clinical/patients/${patientId}/trajectory?weeks=16`),
    { enabled: !!patientId }
  )

  const { register, handleSubmit } = useForm({
    defaultValues: {
      clinicianNotes: session?.clinicianNotes || '',
      phq9Actual: session?.phq9Actual || '',
      gad7Actual: session?.gad7Actual || '',
      observedIndicators: session?.observedIndicators || [],
      referralRecommended: session?.referralRecommended || false,
      priorityFlag: session?.priorityFlag || false,
    },
  })

  if (isLoading) return <LoadingScreen />

  // ── Biomarker data from real session ─────────────────────────────────────────
  const rawBiomarkers = session?.vocacoreResults?.biomarkerFindings || {}
  const biomarkers = Object.entries(rawBiomarkers).map(([key, val]) => ({
    key,
    name:     BIOMARKER_LABELS[key] || key.replace(/_/g, ' '),
    finding:  val.finding  || 'No data',
    severity: val.severity || 'low',
    value:    val.value    ?? null,
    unit:     val.unit     || '',
    norm:     val.norm     || '',
  }))

  // ── Trajectory chart data ─────────────────────────────────────────────────────
  const chartPoints  = trajectory?.dataPoints || []
  const summary      = trajectory?.summary    || {}
  const baselineAvg  = summary.baselineAvg    || {}

  // Format dates for X axis
  const chartData = chartPoints.map(pt => ({
    ...pt,
    label: new Date(pt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }))

  // Toggle line visibility
  const toggleLine = (key) =>
    setActiveLines(prev => ({ ...prev, [key]: !prev[key] }))

  const tabs = [
    // ── OVERVIEW TAB ────────────────────────────────────────────────────────────
    {
      label: 'Overview',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex justify-center">
              <ScoreGauge score={session?.vocacoreResults?.dimensionalScores?.depression ?? session?.depression ?? 0} label="Depression" size="md" />
            </div>
            <div className="flex justify-center">
              <ScoreGauge score={session?.vocacoreResults?.dimensionalScores?.anxiety ?? session?.anxiety ?? 0} label="Anxiety" size="md" />
            </div>
            <div className="flex justify-center">
              <ScoreGauge score={session?.vocacoreResults?.dimensionalScores?.stress ?? session?.stress ?? 0} label="Stress" size="md" />
            </div>
            <div className="flex justify-center">
              <ScoreGauge score={session?.employeeWellnessOutput?.wellnessScore ?? session?.emotionalStability ?? 0} label="Wellness" size="md" />
            </div>
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Risk Assessment</CardTitle>
              <Badge
                variant={
                  session?.vocacoreResults?.overallRiskLevel === 'red'    ? 'danger'
                  : session?.vocacoreResults?.overallRiskLevel === 'orange' ? 'warning'
                  : session?.vocacoreResults?.overallRiskLevel === 'yellow' ? 'info'
                  : 'success'
                }
                size="lg"
              >
                {(session?.vocacoreResults?.overallRiskLevel || 'LOW').toUpperCase()}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">VocaCore™ Confidence</span>
                <p className="text-xl font-bold text-app mt-1">{session?.vocacoreResults?.confidence ?? session?.confidence ?? 0}%</p>
              </div>
              <div>
                <span className="font-medium">PHQ-9 Equiv.</span>
                <p className="text-xl font-bold text-app mt-1">{session?.vocacoreResults?.standardScales?.phq9?.score ?? '—'}</p>
                <p className="text-xs text-gray-400">{session?.vocacoreResults?.standardScales?.phq9?.tier ?? ''}</p>
              </div>
              <div>
                <span className="font-medium">GAD-7 Equiv.</span>
                <p className="text-xl font-bold text-app mt-1">{session?.vocacoreResults?.standardScales?.gad7?.score ?? '—'}</p>
                <p className="text-xs text-gray-400">{session?.vocacoreResults?.standardScales?.gad7?.tier ?? ''}</p>
              </div>
            </div>
            {session?.vocacoreResults?.algorithmVersion && (
              <p className="mt-3 text-xs text-gray-400">
                Scored by: {session.vocacoreResults.algorithmVersion.replace(/_/g, ' ')} · {session.vocacoreResults.engineVersion}
              </p>
            )}
          </Card>

          {/* Gemini AI Insights (if available) */}
          {session?.aiInsights?.keyFindings && (
            <Card className="border-l-4 border-blue-500">
              <CardTitle>AI Clinical Insight</CardTitle>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">{session.aiInsights.keyFindings}</p>
              {session.aiInsights.linguisticIndicators && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500">
                  {Object.entries(session.aiInsights.linguisticIndicators).map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded px-2 py-1">
                      <p className="font-medium capitalize">{k.replace(/_/g, ' ')}</p>
                      <p className="text-app font-bold">{v}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">Source: {session.aiInsights.scorerUsed?.replace(/_/g, ' ')}</p>
            </Card>
          )}
        </div>
      ),
    },

    // ── BIOMARKERS TAB ──────────────────────────────────────────────────────────
    {
      label: 'Biomarkers',
      content: (
        <div className="space-y-4">
          {biomarkers.length === 0 ? (
            <Card>
              <p className="text-gray-500 text-sm">Voice biomarker data not available for this session.</p>
            </Card>
          ) : (
            biomarkers.map((bm) => (
              <Card key={bm.key} className="border-l-4 border-cittaa-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-app">{bm.name}</h4>
                      {bm.value !== null && (
                        <span className="text-xs text-gray-400 font-mono">
                          {bm.value} {bm.unit}
                          {bm.norm ? ` (norm: ${bm.norm})` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{bm.finding}</p>
                  </div>
                  <Badge variant={severityVariant(bm.severity)} className="ml-4 shrink-0">
                    {bm.severity}
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      ),
    },

    // ── TRENDS TAB ──────────────────────────────────────────────────────────────
    {
      label: 'Trends',
      content: (
        <div className="space-y-6">
          {/* Summary cards */}
          {summary.totalSessions > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="text-center py-3">
                <p className="text-xs text-gray-500">Total Sessions</p>
                <p className="text-2xl font-bold text-app">{summary.totalSessions}</p>
              </Card>
              <Card className="text-center py-3">
                <p className="text-xs text-gray-500">Avg Wellness</p>
                <p className="text-2xl font-bold text-app">{summary.avgWellness ?? '—'}</p>
              </Card>
              <Card className="text-center py-3">
                <p className="text-xs text-gray-500">Avg Depression</p>
                <p className="text-2xl font-bold text-app">{summary.avgDepression ?? '—'}</p>
              </Card>
              <Card className="text-center py-3">
                <p className="text-xs text-gray-500">Overall Trend</p>
                <div className="mt-1 flex justify-center">
                  <TrendBadge trend={summary.overallTrend} />
                </div>
              </Card>
            </div>
          )}

          {/* Personal baseline comparison */}
          {baselineAvg.wellness != null && (
            <Card className="border-l-4 border-purple-500">
              <CardTitle>Personal Baseline</CardTitle>
              <p className="text-xs text-gray-500 mb-3">Rolling average of all prior sessions — deviation indicates change from this individual's norm</p>
              <div className="grid grid-cols-4 gap-3 text-center text-sm">
                {['depression', 'anxiety', 'stress', 'wellness'].map(dim => {
                  const cur = chartPoints.at(-1)?.[dim]
                  const base = baselineAvg[dim]
                  const delta = cur != null && base != null ? +(cur - base).toFixed(1) : null
                  return (
                    <div key={dim} className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs font-medium text-gray-600 capitalize">{dim}</p>
                      <p className="text-lg font-bold text-app">{cur ?? '—'}</p>
                      <p className="text-xs text-gray-400">baseline {base != null ? base.toFixed(1) : '—'}</p>
                      {delta !== null && (
                        <p className={`text-xs font-semibold ${delta > 5 ? (dim === 'wellness' ? 'text-green-600' : 'text-red-500') : delta < -5 ? (dim === 'wellness' ? 'text-red-500' : 'text-green-600') : 'text-gray-500'}`}>
                          {delta > 0 ? `+${delta}` : delta}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Line chart */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Score Trajectory (last 16 weeks)</CardTitle>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(LINE_COLORS).map(([key, color]) => (
                  <button
                    key={key}
                    onClick={() => toggleLine(key)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-opacity ${activeLines[key] ? 'opacity-100' : 'opacity-40'}`}
                    style={{ borderColor: color, color }}
                  >
                    <span className="inline-block w-3 h-0.5 rounded" style={{ background: color }} />
                    <span className="capitalize">{key}</span>
                  </button>
                ))}
              </div>
            </div>

            {trajectoryLoading ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading trajectory…</div>
            ) : chartData.length < 2 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                At least 2 completed sessions needed to show a trend.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} width={32} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />

                  {/* Personal baseline reference lines */}
                  {baselineAvg.depression != null && activeLines.depression && (
                    <ReferenceLine y={baselineAvg.depression} stroke={LINE_COLORS.depression} strokeDasharray="4 4" strokeOpacity={0.4} />
                  )}
                  {baselineAvg.wellness != null && activeLines.wellness && (
                    <ReferenceLine y={baselineAvg.wellness} stroke={LINE_COLORS.wellness} strokeDasharray="4 4" strokeOpacity={0.4} />
                  )}

                  {activeLines.depression && (
                    <Line type="monotone" dataKey="depression" stroke={LINE_COLORS.depression} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  )}
                  {activeLines.anxiety && (
                    <Line type="monotone" dataKey="anxiety" stroke={LINE_COLORS.anxiety} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  )}
                  {activeLines.stress && (
                    <Line type="monotone" dataKey="stress" stroke={LINE_COLORS.stress} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  )}
                  {activeLines.wellness && (
                    <Line type="monotone" dataKey="wellness" stroke={LINE_COLORS.wellness} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      ),
    },

    // ── CLINICAL NOTES TAB ──────────────────────────────────────────────────────
    {
      label: 'Clinical Notes',
      content: (
        <form onSubmit={handleSubmit(async (data) => {
          try {
            await api.put(`/sessions/${id}`, data)
            toast.success('Notes saved')
          } catch {
            toast.error('Failed to save notes')
          }
        })} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app mb-2">Clinician Notes</label>
            <textarea className="input-base w-full resize-none" rows={4} {...register('clinicianNotes')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input type="number" placeholder="PHQ-9 Score" min={0} max={27} {...register('phq9Actual')} className="input-base" />
            <input type="number" placeholder="GAD-7 Score" min={0} max={21} {...register('gad7Actual')} className="input-base" />
          </div>
          <Button type="submit" variant="primary">Save Notes</Button>
        </form>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-app">Assessment Results</h1>
          <p className="text-gray-600">Patient: {session?.patientName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={async () => {
            try {
              const res = await api.get(`/sessions/${id}/report`, { responseType: 'blob' })
              const url = URL.createObjectURL(res)
              const a = document.createElement('a'); a.href = url; a.download = `session-${id}-report.pdf`; a.click()
            } catch {
              toast.error('PDF report not available yet')
            }
          }}>Generate PDF Report</Button>
        </div>
      </div>

      <Tabs tabs={tabs} />

      <div className="flex gap-4 flex-wrap">
        <Button variant="primary" onClick={() => setConsultationModalOpen(true)}>
          Book Consultation
        </Button>
        <Button variant="secondary" onClick={() => setConsultationModalOpen(true)}>
          Schedule Follow-up
        </Button>
      </div>

      <ConsultationBookingModal
        isOpen={consultationModalOpen}
        onClose={() => setConsultationModalOpen(false)}
        patientId={patientId}
      />
    </div>
  )
}

export default SessionResults
