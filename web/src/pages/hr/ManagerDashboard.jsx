import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, AlertTriangle, TrendingDown, TrendingUp, Minus,
  MessageCircle, ChevronRight, CheckCircle2, BookOpen,
  Flame, Shield, Brain, Zap, Wind, BarChart3, Info,
  ChevronDown, ChevronUp, Building2, Heart
} from 'lucide-react'
import { Card, Button } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

const URGENCY_COLOR = {
  high:   { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',   dot: 'bg-red-500'   },
  medium: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  low:    { bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',  dot: 'bg-blue-400'  },
}

const RISK_COLOR = {
  red:    'bg-red-500',
  orange: 'bg-orange-400',
  yellow: 'bg-yellow-400',
  green:  'bg-green-500',
}

const DIM_ICON = { depression: Brain, anxiety: Zap, stress: Flame, burnout: Wind }
const DIM_LABEL = { depression: 'Low Mood', anxiety: 'Anxiety', stress: 'Stress', burnout: 'Burnout' }

// ── Team Risk Heatmap card ─────────────────────────────────────────────────────
function DeptHeatmapCard({ dept }) {
  const riskPct = dept.sessionCount
    ? Math.round((dept.riskDistribution.orange + dept.riskDistribution.red) / dept.sessionCount * 100)
    : 0
  const DomIcon = DIM_ICON[dept.dominantConcern] || Brain
  const riskColor = riskPct > 30 ? 'text-red-600' : riskPct > 15 ? 'text-amber-600' : 'text-green-600'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cittaa-100 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-cittaa-700" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm capitalize">
              {dept.departmentId === 'unassigned' ? 'General' : dept.departmentId}
            </p>
            <p className="text-xs text-gray-400">{dept.employeeCount} employees · {dept.sessionCount} sessions</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${riskColor}`}>{dept.avgWellnessScore}</p>
          <p className="text-xs text-gray-400">avg score</p>
        </div>
      </div>

      {/* Risk distribution bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-3">
        {['green','yellow','orange','red'].map(lvl => {
          const count = dept.riskDistribution[lvl] || 0
          const pct   = dept.sessionCount ? (count / dept.sessionCount * 100) : 0
          return pct > 0 ? (
            <div key={lvl} className={`${RISK_COLOR[lvl]} transition-all`} style={{ width: `${pct}%` }} />
          ) : null
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <DomIcon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">Main concern: <span className="font-medium text-gray-700">{DIM_LABEL[dept.dominantConcern] || dept.dominantConcern}</span></span>
        </div>
        {dept.atRiskCount > 0 && (
          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {dept.atRiskCount} at risk
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── Coaching Action Item card ─────────────────────────────────────────────────
function ActionItemCard({ item, onResolve }) {
  const [expanded, setExpanded] = useState(false)
  const [resolving, setResolving] = useState(false)
  const uc = URGENCY_COLOR[item.urgency] || URGENCY_COLOR.low

  const handleResolve = async () => {
    setResolving(true)
    try {
      await api.post(`/coaching/action-items/${item.alertId}/resolve`, { note: 'Coaching action completed by manager' })
      toast.success('Marked as addressed')
      onResolve(item.alertId)
    } catch {
      toast.error('Could not update — please try again')
    } finally {
      setResolving(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-xl border ${uc.border} ${uc.bg} p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${uc.dot}`} />
          <div className="min-w-0">
            <p className={`font-semibold text-sm ${uc.text}`}>{item.playbookTitle}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {item.dominantConcern} · score {item.wellnessScore ?? '—'} · {item.riskLevel} risk
              · triggered {new Date(item.triggeredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">
              {/* Conversation starter */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> What to say
                </p>
                <div className="bg-white rounded-lg border border-gray-100 p-3">
                  <p className="text-sm text-gray-700 italic">{item.topConversationStarter}</p>
                </div>
              </div>

              {/* Actions */}
              {item.topActions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> Recommended actions
                  </p>
                  <div className="space-y-2">
                    {item.topActions.map(action => (
                      <div key={action.id} className="bg-white rounded-lg border border-gray-100 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm text-gray-800">{action.title}</p>
                          <span className="text-xs text-gray-400 flex-shrink-0">{action.timeframe}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{action.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Escalate if */}
              {item.escalateIf && (
                <div className="flex items-start gap-2 bg-white rounded-lg border border-amber-100 p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600"><span className="font-medium">Escalate if:</span> {item.escalateIf}</p>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleResolve}
                  disabled={resolving}
                  className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm px-4 py-1.5 rounded-lg flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {resolving ? 'Updating...' : 'Mark as Addressed'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const [heatmap,     setHeatmap]     = useState(null)
  const [actionItems, setActionItems] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState('overview')
  const [playbook,    setPlaybook]    = useState(null)
  const [pbDimension, setPbDimension] = useState('stress')
  const [pbRisk,      setPbRisk]      = useState('red')

  useEffect(() => {
    const load = async () => {
      try {
        const [hm, ai] = await Promise.all([
          api.get('/coaching/team-heatmap?days=14'),
          api.get('/coaching/action-items'),
        ])
        setHeatmap(hm)
        setActionItems(ai.actionItems || [])
      } catch (err) {
        toast.error('Could not load coaching data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const loadPlaybook = async (dimension, riskLevel) => {
    try {
      const data = await api.get(`/coaching/playbook?dimension=${dimension}&riskLevel=${riskLevel}`)
      setPlaybook(data.playbook)
      setPbDimension(dimension)
      setPbRisk(riskLevel)
    } catch { toast.error('Could not load playbook') }
  }

  const removeActionItem = (alertId) => setActionItems(prev => prev.filter(i => i.alertId !== alertId))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-4 border-cittaa-200 border-t-cittaa-700 animate-spin" />
      </div>
    )
  }

  const summary = heatmap?.summary || {}

  const tabs = [
    { id: 'overview',  label: 'Team Overview', icon: Users },
    { id: 'actions',   label: `Action Items${actionItems.length ? ` (${actionItems.length})` : ''}`, icon: AlertTriangle },
    { id: 'playbooks', label: 'Coaching Playbooks', icon: BookOpen },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manager Coaching</h1>
        <p className="text-gray-500 text-sm mt-1">Anonymised team wellness data · Individual names are not shown</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Alerts',     value: summary.activeAlerts ?? '—',  icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: 'At-Risk Sessions',  value: `${summary.atRiskPct ?? 0}%`, icon: Shield,        color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Avg Wellness',      value: summary.avgWellnessScore ?? '—', icon: Heart,      color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Check-ins (14d)',   value: summary.totalSessions ?? '—', icon: BarChart3,     color: 'text-cittaa-700', bg: 'bg-cittaa-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 border border-gray-100`}>
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === id ? 'bg-white text-cittaa-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4 hidden sm:block" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {heatmap?.departments?.length > 0 ? (
              <>
                <p className="text-sm text-gray-500 mb-3">Department risk breakdown — last 14 days</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {heatmap.departments.map(dept => (
                    <DeptHeatmapCard key={dept.departmentId} dept={dept} />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                  {['green','yellow','orange','red'].map(c => (
                    <span key={c} className="flex items-center gap-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${RISK_COLOR[c]}`} /> {c}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No check-in data for the past 14 days</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ACTION ITEMS TAB */}
        {activeTab === 'actions' && (
          <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {actionItems.length === 0 ? (
              <div className="text-center py-12 bg-green-50 rounded-xl border border-green-100">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-green-700">All clear</p>
                <p className="text-sm text-green-600 mt-1">No pending action items right now</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">Expand each item to see conversation starters and recommended actions.</p>
                <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700">Individual employee names are not shown. Support your team without singling anyone out.</p>
                </div>
                {actionItems.map(item => (
                  <ActionItemCard key={item.alertId} item={item} onResolve={removeActionItem} />
                ))}
              </>
            )}
          </motion.div>
        )}

        {/* PLAYBOOKS TAB */}
        {activeTab === 'playbooks' && (
          <motion.div key="playbooks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* Selector */}
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Concern type</label>
                <div className="flex gap-2">
                  {['stress','depression','anxiety'].map(d => (
                    <button key={d}
                      onClick={() => { setPbDimension(d); setPlaybook(null) }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all capitalize ${
                        pbDimension === d ? 'bg-cittaa-700 text-white border-cittaa-700' : 'bg-white text-gray-600 border-gray-200 hover:border-cittaa-300'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Severity</label>
                <div className="flex gap-2">
                  {[['red','High'],['orange','Moderate']].map(([v, lbl]) => (
                    <button key={v}
                      onClick={() => { setPbRisk(v); setPlaybook(null) }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        pbRisk === v ? 'bg-cittaa-700 text-white border-cittaa-700' : 'bg-white text-gray-600 border-gray-200 hover:border-cittaa-300'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => loadPlaybook(pbDimension, pbRisk)}
                  className="bg-cittaa-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-cittaa-800 flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" /> Load Playbook
                </Button>
              </div>
            </div>

            {playbook && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-gradient-to-br from-cittaa-700 to-purple-800 rounded-xl p-5 text-white">
                  <h3 className="font-bold text-lg">{playbook.title}</h3>
                  <p className="text-white/80 text-sm mt-1">{playbook.summary}</p>
                </div>

                {/* Conversation starters */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-cittaa-600" /> Conversation Starters
                  </h4>
                  <div className="space-y-2">
                    {playbook.conversationStarters?.map((s, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-sm text-gray-700 italic">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-cittaa-600" /> Recommended Actions
                  </h4>
                  <div className="space-y-3">
                    {playbook.actions?.map(action => (
                      <div key={action.id} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold text-gray-800">{action.title}</p>
                          <div className="flex gap-2 flex-shrink-0">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{action.timeframe}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${action.impact === 'very_high' || action.impact === 'high' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                              {action.impact?.replace('_', ' ')} impact
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">{action.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Do nots */}
                {playbook.doNot?.length > 0 && (
                  <div className="bg-red-50 rounded-xl border border-red-100 p-4">
                    <h4 className="font-semibold text-red-700 mb-2 text-sm">What NOT to do</h4>
                    <ul className="space-y-1">
                      {playbook.doNot.map((d, i) => (
                        <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                          <span className="mt-1 w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Escalate if */}
                {playbook.escalateIf && (
                  <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-700 text-sm">When to escalate to HR</p>
                      <p className="text-sm text-amber-600 mt-0.5">{playbook.escalateIf}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {!playbook && (
              <div className="text-center py-10 text-gray-400">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Select a concern type and severity, then load the playbook</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
