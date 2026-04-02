import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import {
  AlertTriangle, UserCheck, ChevronDown, ChevronRight,
  X, Check, Users, ShieldAlert, Clock, Loader2
} from 'lucide-react'

const RISK_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  high:     'bg-orange-100 text-orange-700 border-orange-300',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-300',
  low:      'bg-blue-100 text-blue-700 border-blue-300',
}
const STATUS_COLORS = {
  new:         'bg-red-50 text-red-700',
  escalated:   'bg-orange-50 text-orange-700',
  in_progress: 'bg-blue-50 text-blue-700',
  acknowledged:'bg-yellow-50 text-yellow-700',
  resolved:    'bg-green-50 text-green-700',
}

// ── Assign Psychologist Modal ─────────────────────────────────────────────────
function AssignModal({ alert, psychologists, onClose, onAssigned }) {
  const [selected, setSelected] = useState(
    new Set((alert.assignees || []).map(a => a._id?.toString() || a))
  )
  const [saving, setSaving] = useState(false)
  const [note, setNote]     = useState('')

  const toggle = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const save = async () => {
    if (selected.size === 0) return toast.error('Select at least one psychologist')
    setSaving(true)
    try {
      await api.put(`/alerts/${alert._id}/assign`, {
        psychologistIds: Array.from(selected),
        note,
      })
      toast.success('Psychologist(s) assigned successfully')
      onAssigned()
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Assignment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-bold text-app text-lg">Assign Psychologist</h3>
            <p className="text-xs text-gray-400 mt-0.5">Employee: {alert.employeeName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Risk summary */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex gap-3 flex-wrap">
            {alert.riskDetails?.dimensionalScores && (
              <>
                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg font-medium">
                  Dep: {alert.riskDetails.dimensionalScores.depression ?? '—'}
                </span>
                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-medium">
                  Anx: {alert.riskDetails.dimensionalScores.anxiety ?? '—'}
                </span>
                <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg font-medium">
                  Str: {alert.riskDetails.dimensionalScores.stress ?? '—'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Psychologist list */}
        <div className="px-5 py-3 max-h-64 overflow-y-auto space-y-2">
          {psychologists.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No psychologists available in this tenant</p>
          ) : (
            psychologists.map(p => (
              <label key={p._id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${selected.has(p._id?.toString()) ? 'bg-violet-50 border-violet-300' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                <input
                  type="checkbox"
                  checked={selected.has(p._id?.toString())}
                  onChange={() => toggle(p._id?.toString())}
                  className="accent-violet-600 w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-app truncate">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{p.email}</p>
                </div>
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {p.role === 'SENIOR_CLINICIAN' ? 'Sr. Clinician' : 'Psychologist'}
                </span>
              </label>
            ))
          )}
        </div>

        {/* Note */}
        <div className="px-5 py-3">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Assignment note (optional)"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || selected.size === 0}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Assign {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Alert row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert, psychologists, onRefetch }) {
  const [expanded, setExpanded]   = useState(false)
  const [assigning, setAssigning] = useState(false)

  return (
    <>
      <tr
        className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="py-3 pl-4">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </td>
        <td className="py-3">
          <p className="font-semibold text-app text-sm">{alert.employeeName || 'Unknown'}</p>
          <p className="text-xs text-gray-400">{alert.department || '—'}</p>
        </td>
        <td className="py-3">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold capitalize ${RISK_COLORS[alert.severity] || 'bg-gray-100 text-gray-600'}`}>
            {alert.severity}
          </span>
        </td>
        <td className="py-3 text-sm text-gray-600 max-w-xs">
          <p className="truncate">{alert.title}</p>
        </td>
        <td className="py-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${STATUS_COLORS[alert.status] || 'bg-gray-100 text-gray-600'}`}>
            {alert.status?.replace('_', ' ')}
          </span>
        </td>
        <td className="py-3 text-xs text-gray-400">
          {alert.assignees?.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {alert.assignees.map(a => (
                <span key={a._id || a} className="bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {a.firstName ? `${a.firstName} ${a.lastName}` : a}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-300 italic">Unassigned</span>
          )}
        </td>
        <td className="py-3 text-xs text-gray-400 pr-4">
          {alert.triggeredAt ? format(new Date(alert.triggeredAt), 'dd MMM HH:mm') : '—'}
        </td>
        <td className="py-3 pr-4">
          <button
            onClick={e => { e.stopPropagation(); setAssigning(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Assign
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-violet-50/30">
          <td colSpan={8} className="px-8 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Alert Message</p>
                <p className="text-gray-700">{alert.message}</p>
              </div>
              {alert.riskDetails?.dimensionalScores && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Dimension Scores</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs font-medium">
                      Depression: {alert.riskDetails.dimensionalScores.depression ?? '—'}
                    </span>
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs font-medium">
                      Anxiety: {alert.riskDetails.dimensionalScores.anxiety ?? '—'}
                    </span>
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded-lg text-xs font-medium">
                      Stress: {alert.riskDetails.dimensionalScores.stress ?? '—'}
                    </span>
                  </div>
                </div>
              )}
              {alert.escalationReason && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Escalation Reason</p>
                  <p className="text-gray-700">{alert.escalationReason}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Assign modal */}
      <AnimatePresence>
        {assigning && (
          <AssignModal
            alert={alert}
            psychologists={psychologists}
            onClose={() => setAssigning(false)}
            onAssigned={onRefetch}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export const EscalationManagement = () => {
  const [statusFilter, setStatusFilter] = useState('escalated')
  const [page, setPage]                 = useState(1)

  const { data: alertsResp, isLoading, refetch } = useApi(
    ['alerts', 'escalated', statusFilter, page],
    () => api.get(`/alerts/escalated?page=${page}&limit=25`),
    { retry: 1 }
  )

  const { data: psychResp } = useApi(
    ['psychologists', 'list'],
    () => api.get('/users?role=SENIOR_CLINICIAN,CLINICAL_PSYCHOLOGIST'),
    { retry: 1 }
  )

  const alertsData  = alertsResp?.data
  const alerts      = alertsData?.alerts || []
  const total       = alertsData?.total  || 0
  const pages       = alertsData?.pages  || 1
  const psychs      = psychResp?.data    || []

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-app flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-orange-600" />
            Escalation Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Assign psychologists to high-risk and escalated cases
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500">{total} case{total !== 1 ? 's' : ''}</span>
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Escalated', value: total,                           color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Unassigned',      value: alerts.filter(a => !a.assignees?.length).length, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Assigned',        value: alerts.filter(a => a.assignees?.length > 0).length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Psychologists',   value: psychs.length,                   color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 flex flex-col gap-1`}>
            <span className="text-xs text-gray-500 font-medium">{s.label}</span>
            <span className={`text-3xl font-extrabold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-3">
                <Users className="w-7 h-7 text-green-400" />
              </div>
              <p className="font-semibold text-gray-400">No escalated cases</p>
              <p className="text-xs text-gray-300 mt-1">All alerts are within normal handling</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-50 border-b">
                  <th className="py-3 pl-4 w-8" />
                  <th className="py-3 text-left font-semibold">Employee</th>
                  <th className="py-3 text-left font-semibold">Severity</th>
                  <th className="py-3 text-left font-semibold">Alert</th>
                  <th className="py-3 text-left font-semibold">Status</th>
                  <th className="py-3 text-left font-semibold">Assigned To</th>
                  <th className="py-3 text-left font-semibold">Triggered</th>
                  <th className="py-3 pr-4 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <AlertRow
                    key={alert._id}
                    alert={alert}
                    psychologists={psychs}
                    onRefetch={refetch}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page} of {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              className="px-4 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}

export default EscalationManagement
