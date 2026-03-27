import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, LoadingScreen, Tabs } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { UserPlus, X, Save, Shield, Users2, AlertTriangle } from 'lucide-react'

const IST = { timeZone: 'Asia/Kolkata' }

/* ── small role badge ── */
const ROLE_COLORS = {
  COMPANY_ADMIN:         'bg-violet-100 text-violet-700',
  HR_ADMIN:              'bg-blue-100 text-blue-700',
  EMPLOYEE:              'bg-gray-100 text-gray-600',
  SENIOR_CLINICIAN:      'bg-teal-100 text-teal-700',
  CLINICAL_PSYCHOLOGIST: 'bg-emerald-100 text-emerald-700',
  EAP_PROVIDER:          'bg-orange-100 text-orange-700',
}
function RoleBadge({ role }) {
  const cls = ROLE_COLORS[role] || 'bg-gray-100 text-gray-500'
  const label = (role || '').replace(/_/g, ' ')
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {label.toLowerCase()}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════
 * Main page
 * ══════════════════════════════════════════════════════════════════ */
export const TenantDetail = () => {
  const { id } = useParams()
  const { data: raw, isLoading, refetch } = useApi(['tenant', id], () => api.get(`/tenants/${id}`))

  if (isLoading) return <LoadingScreen />

  // Backend returns { tenant: {...}, stats: {...} }
  const tenant = raw?.tenant || raw

  const tabs = [
    { label: 'Overview',  content: <TenantOverview tenant={tenant} stats={raw?.stats} /> },
    { label: 'Users',     content: <TenantUsers tenantId={id} tenantStringId={tenant?.tenantId} /> },
    { label: 'Analytics', content: <div className="text-gray-500 p-4 text-sm">Analytics will appear here once data is collected.</div> },
    { label: 'Settings',  content: <TenantSettings tenant={tenant} tenantId={id} onSaved={refetch} /> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-app">{tenant?.displayName || tenant?.legalName || '—'}</h1>
        <p className="text-gray-600 text-sm">
          {[tenant?.industry, tenant?.city].filter(Boolean).join(' · ')}
        </p>
      </div>
      <Tabs tabs={tabs} />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
 * Overview tab
 * ══════════════════════════════════════════════════════════════════ */
const TenantOverview = ({ tenant, stats }) => {
  if (!tenant) return <div className="text-gray-500 p-4">No tenant data found.</div>
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6">
        <CardTitle>Company Details</CardTitle>
        <div className="mt-4 space-y-3">
          {[
            { label: 'Legal Name',     value: tenant.legalName || tenant.displayName },
            { label: 'Industry',       value: tenant.industry },
            { label: 'Employees',      value: tenant.employeeCount },
            { label: 'City',           value: tenant.city },
            { label: 'Contact Email',  value: tenant.contactEmail },
            { label: 'Tenant ID',      value: tenant.tenantId, mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label}>
              <p className="text-sm text-gray-500">{label}</p>
              <p className={`font-medium text-app ${mono ? 'font-mono text-xs text-gray-500' : ''}`}>
                {value ?? '—'}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <CardTitle>Subscription Details</CardTitle>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
              tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {tenant.status || 'active'}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Contract Tier</p>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 capitalize">
              {tenant.contractTier || '—'}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Assessment Quota</p>
            <p className="font-medium text-app">{tenant.monthlyAssessmentQuota ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="font-medium text-app">
              {tenant.createdAt
                ? new Date(tenant.createdAt).toLocaleDateString('en-IN', { ...IST, dateStyle: 'medium' })
                : '—'}
            </p>
          </div>
        </div>

        {stats && (
          <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-violet-50 rounded-xl">
              <p className="text-2xl font-bold text-violet-600">{stats.adminCount ?? 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">Admins</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-600">{stats.employeeCount ?? 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">Employees</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
 * Users tab
 * ══════════════════════════════════════════════════════════════════ */
const ALL_ROLES = [
  'COMPANY_ADMIN', 'HR_ADMIN', 'EMPLOYEE',
  'SENIOR_CLINICIAN', 'CLINICAL_PSYCHOLOGIST', 'EAP_PROVIDER',
]

const TenantUsers = ({ tenantId, tenantStringId }) => {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)  // for individual view

  const { data, isLoading, refetch } = useApi(
    ['tenant-users', tenantId, roleFilter],
    () => api.get('/users', { params: { tenantId: tenantStringId, role: roleFilter || undefined, limit: 100 } })
  )

  const users = data?.data || []
  const filtered = search
    ? users.filter(u =>
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
      )
    : users

  /* deactivate / reactivate toggle */
  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u._id || u.id}`, { isActive: !u.isActive })
      toast.success(`${u.firstName} ${u.isActive ? 'deactivated' : 'reactivated'}`)
      refetch()
      if (selectedUser?._id === u._id) setSelectedUser(prev => ({ ...prev, isActive: !prev.isActive }))
    } catch {
      toast.error('Failed to update user')
    }
  }

  if (selectedUser) {
    return (
      <UserDetailPanel
        user={selectedUser}
        onBack={() => setSelectedUser(null)}
        onToggleActive={toggleActive}
        onSaved={(updated) => { setSelectedUser(updated); refetch() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="flex-1 min-w-0 px-3 py-2 text-sm border rounded-lg outline-none focus:border-violet-400"
          />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg bg-white outline-none focus:border-violet-400"
          >
            <option value="">All roles</option>
            {ALL_ROLES.map(r => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition"
        >
          <UserPlus size={15} /> Add User
        </button>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>

      {/* User list */}
      {isLoading ? (
        <div className="text-gray-400 text-sm p-4">Loading users…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 text-sm">
          No users found{search ? ` matching "${search}"` : ' for this tenant'}.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <Card
              key={u._id || u.id}
              className="p-4 cursor-pointer hover:shadow-md transition"
              onClick={() => setSelectedUser(u)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(u.firstName?.[0] || '') + (u.lastName?.[0] || '')}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-app truncate">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RoleBadge role={u.role} />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showAdd && (
        <AddUserModal
          tenantStringId={tenantStringId}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); refetch() }}
        />
      )}
    </div>
  )
}

/* ── Individual user detail panel ── */
const UserDetailPanel = ({ user: initialUser, onBack, onToggleActive, onSaved }) => {
  const [user, setUser] = useState(initialUser)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, role: user.role, phone: user.phone || '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.patch(`/users/${user._id || user.id}`, form)
      const updated = res?.data || { ...user, ...form }
      setUser(updated)
      onSaved?.(updated)
      setEditing(false)
      toast.success('User updated')
    } catch {
      toast.error('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-violet-600 hover:underline flex items-center gap-1">
        ← Back to users
      </button>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xl">
              {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
            </div>
            <div>
              <h2 className="text-xl font-bold text-app">{user.firstName} {user.lastName}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={user.role} />
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition"
              >
                Edit
              </button>
            )}
            <button
              onClick={() => onToggleActive(user)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
                user.isActive
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              {user.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </div>

        {editing ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'First Name', key: 'firstName' },
              { label: 'Last Name',  key: 'lastName' },
              { label: 'Phone',      key: 'phone' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-violet-400"
                  value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <select
                className="w-full px-3 py-2 text-sm border rounded-lg bg-white outline-none focus:border-violet-400"
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              >
                {ALL_ROLES.map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Phone',       value: user.phone || '—' },
              { label: 'Joined',      value: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { ...IST, dateStyle: 'medium' }) : '—' },
              { label: 'Last Login',  value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN', { ...IST, dateStyle: 'medium', timeStyle: 'short' }) + ' IST' : 'Never' },
              { label: 'Email Verified', value: user.isEmailVerified ? 'Yes' : 'No' },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-medium text-app text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ── Add User Modal ── */
const AddUserModal = ({ tenantStringId, onClose, onCreated }) => {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    role: 'EMPLOYEE', phone: '',
  })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/users', { ...form, tenantId: tenantStringId })
      toast.success(`${form.firstName} added — welcome email sent`)
      onCreated()
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const f = (key, label, type = 'text', required = false) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        required={required}
        className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-violet-400"
        value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold text-app mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-violet-500" /> Add User
        </h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {f('firstName', 'First Name', 'text', true)}
            {f('lastName', 'Last Name', 'text', true)}
          </div>
          {f('email', 'Email Address', 'email', true)}
          {f('phone', 'Phone (optional)')}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role *</label>
            <select
              required
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white outline-none focus:border-violet-400"
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
            >
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-lg text-xs text-violet-700">
            <Shield size={12} />
            A temporary password will be auto-generated and emailed to the user.
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition"
            >
              {saving ? 'Creating…' : 'Create & Send Welcome Email'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
 * Settings tab
 * ══════════════════════════════════════════════════════════════════ */
const TenantSettings = ({ tenant, tenantId, onSaved }) => {
  const [form, setForm] = useState({
    monthlyAssessmentQuota: tenant?.monthlyAssessmentQuota ?? 500,
    status: tenant?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [showSuspend, setShowSuspend] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/tenants/${tenantId}`, form)
      toast.success('Settings saved')
      onSaved?.()
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const suspend = async () => {
    setSaving(true)
    try {
      await api.post(`/tenants/${tenantId}/suspend`, { reason: suspendReason })
      toast.success('Tenant suspended')
      setShowSuspend(false)
      onSaved?.()
    } catch {
      toast.error('Failed to suspend tenant')
    } finally {
      setSaving(false)
    }
  }

  const activate = async () => {
    setSaving(true)
    try {
      await api.post(`/tenants/${tenantId}/activate`)
      toast.success('Tenant reactivated')
      onSaved?.()
    } catch {
      toast.error('Failed to activate tenant')
    } finally {
      setSaving(false)
    }
  }

  const isActive = tenant?.status === 'active' || tenant?.status === 'trial'

  return (
    <div className="space-y-6 max-w-xl">
      <Card className="p-6">
        <CardTitle>Platform Configuration</CardTitle>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Monthly Assessment Quota</label>
            <input
              type="number"
              min={0}
              max={10000}
              className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-violet-400"
              value={form.monthlyAssessmentQuota}
              onChange={e => setForm(p => ({ ...p, monthlyAssessmentQuota: Number(e.target.value) }))}
            />
            <p className="text-xs text-gray-400 mt-1">Max number of assessments this tenant can run per month.</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="mt-5 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition"
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </Card>

      {/* Danger zone */}
      <Card className="p-6 border border-red-200">
        <h3 className="font-semibold text-red-600 flex items-center gap-2 mb-4">
          <AlertTriangle size={16} /> Danger Zone
        </h3>
        {isActive ? (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Suspending a tenant will block all user access immediately. You can reactivate at any time.
            </p>
            {showSuspend ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reason for suspension</label>
                  <input
                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-red-400"
                    placeholder="e.g. Non-payment, Policy violation…"
                    value={suspendReason}
                    onChange={e => setSuspendReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={suspend}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {saving ? 'Suspending…' : 'Confirm Suspend'}
                  </button>
                  <button onClick={() => setShowSuspend(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSuspend(true)}
                className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 border border-red-200 transition"
              >
                Suspend Tenant
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              This tenant is currently <strong>suspended</strong>. Reactivating will restore full access.
            </p>
            <button
              onClick={activate}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              {saving ? 'Activating…' : 'Reactivate Tenant'}
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}

export default TenantDetail
