import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { UserCheck, UserX, Clock, CheckCircle, XCircle, Users, RefreshCw } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const STATUS_TABS = [
  { key: 'pending',  label: 'Pending',  icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  { key: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  { key: 'rejected', label: 'Rejected', icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200'   },
  { key: 'all',      label: 'All',      icon: Users,        color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
]

function RejectModal({ user, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Reject Registration</h3>
        <p className="text-sm text-gray-500 mb-4">
          Rejecting <strong>{user.firstName} {user.lastName}</strong> ({user.email}). They will receive an email.
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional but helpful)</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Service not available in your region yet"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              await onConfirm(reason)
              setLoading(false)
            }}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition disabled:opacity-60"
          >
            {loading ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  }
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function B2CRegistrations() {
  const [tab, setTab]             = useState('pending')
  const [rejectTarget, setReject] = useState(null)
  const [actioning, setActioning] = useState(null)

  const { data, isLoading, refetch } = useApi(
    ['cittaa', 'b2c', tab],
    () => api.get(`/cittaa-admin/b2c-registrations?status=${tab}&limit=100`)
  )
  const { data: stats, refetch: refetchStats } = useApi(
    ['cittaa', 'b2c', 'stats'],
    () => api.get('/cittaa-admin/b2c-registrations/stats')
  )

  const reload = () => { refetch(); refetchStats() }

  const handleApprove = async (user) => {
    setActioning(user.id)
    try {
      await api.post(`/cittaa-admin/b2c-registrations/${user.id}/approve`)
      toast.success(`✅ ${user.firstName} approved — they'll get an email`)
      reload()
    } catch (err) {
      toast.error(err?.error?.message || 'Approval failed')
    } finally {
      setActioning(null)
    }
  }

  const handleReject = async (reason) => {
    try {
      await api.post(`/cittaa-admin/b2c-registrations/${rejectTarget.id}/reject`, { reason })
      toast.success(`${rejectTarget.firstName}'s registration rejected`)
      setReject(null)
      reload()
    } catch (err) {
      toast.error(err?.error?.message || 'Rejection failed')
    }
  }

  const users = data?.data || []
  const st = stats?.data || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Individual (B2C) Registrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            People who sign up on <span className="font-medium text-purple-700">mind.cittaa.in</span> — requires your approval before they can log in
          </p>
        </div>
        <button onClick={reload} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review',  value: st.pending  || 0, icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50'  },
          { label: 'Approved',        value: st.approved || 0, icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Rejected',        value: st.rejected || 0, icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: 'Total B2C Users', value: st.total    || 0, icon: Users,        color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className={`p-4 ${bg}`}>
            <div className="flex items-center gap-3">
              <Icon className={`w-6 h-6 ${color}`} />
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100 pb-0">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition ${
              tab === t.key
                ? `${t.color} border-current ${t.bg}`
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.key === 'pending' && st.pending > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {st.pending > 9 ? '9+' : st.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingScreen />
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No {tab === 'all' ? '' : tab} registrations</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Registered</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  {tab === 'pending' && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.firstName} {u.lastName}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.registeredAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={u.approvalStatus} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                      {u.approvalStatus === 'approved' && `Approved ${formatDate(u.approvedAt)}`}
                      {u.approvalStatus === 'rejected' && (u.rejectionReason || `Rejected ${formatDate(u.rejectedAt)}`)}
                    </td>
                    {tab === 'pending' && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={actioning === u.id}
                            onClick={() => handleApprove(u)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            {actioning === u.id ? 'Approving…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => setReject(u)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {rejectTarget && (
        <RejectModal user={rejectTarget} onClose={() => setReject(null)} onConfirm={handleReject} />
      )}
    </div>
  )
}
