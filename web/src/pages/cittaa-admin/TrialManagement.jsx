/**
 * Trial Management Page
 * Available to CITTAA_SUPER_ADMIN and CITTAA_CEO.
 * Allows starting, extending, inviting to, and converting trials.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Play, UserPlus, UserMinus, TrendingUp, Clock,
  CheckCircle2, XCircle, RefreshCw, ChevronDown,
  AlertTriangle, CalendarDays, Users, Zap
} from 'lucide-react'
import api from '../../services/api'

/* ── helpers ── */
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const badge = (label, color) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
    background: color + '20', color,
  }}>{label}</span>
)

const COLORS = { primary: '#4a9080', accent: '#8b7dd8', warn: '#d97706', danger: '#c0544a', muted: '#718096' }

/* ── small reusable card ── */
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid #e2eae7', padding: 24,
      boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── input helper ── */
function Field({ label, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#4a5568' }}>{label}</label>
      <input
        {...props}
        style={{
          padding: '8px 12px', borderRadius: 8,
          border: '1.5px solid #e2eae7', fontSize: 14,
          outline: 'none', fontFamily: 'inherit',
          ...props.style,
        }}
      />
    </div>
  )
}

function Btn({ children, variant = 'primary', loading, onClick, disabled, style = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    border: 'none', transition: 'opacity .15s',
    opacity: disabled || loading ? 0.6 : 1,
    fontFamily: 'inherit',
    ...style,
  }
  const themes = {
    primary:  { background: COLORS.primary, color: '#fff' },
    accent:   { background: COLORS.accent,  color: '#fff' },
    outline:  { background: '#fff', color: COLORS.primary, border: `1.5px solid ${COLORS.primary}` },
    danger:   { background: COLORS.danger,  color: '#fff' },
    warn:     { background: COLORS.warn,    color: '#fff' },
  }
  return (
    <button style={{ ...base, ...themes[variant] }} onClick={onClick} disabled={disabled || loading}>
      {loading && <RefreshCw size={14} style={{ animation: 'spin .7s linear infinite' }} />}
      {children}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function TrialManagement() {
  const [tenants, setTenants] = useState([])
  const [selected, setSelected] = useState(null)
  const [trialStatus, setTrialStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'success'|'error', text }

  // Start trial form
  const [startForm, setStartForm] = useState({
    durationDays: 14, maxUsers: 20, invitedEmails: ''
  })

  // Invite form
  const [inviteEmails, setInviteEmails] = useState('')

  // Remove form
  const [removeEmail, setRemoveEmail] = useState('')

  // Extend form
  const [extraDays, setExtraDays] = useState(7)

  // Convert tier
  const [contractTier, setContractTier] = useState('starter')

  const flash = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  /* Load tenants */
  useEffect(() => {
    api.get('/tenants')
      .then(res => {
        const list = res?.data?.tenants || res?.data || []
        setTenants(Array.isArray(list) ? list : [])
      })
      .catch(() => setTenants([]))
  }, [])

  /* Load trial status when tenant selected */
  const loadTrialStatus = useCallback(async (tenantMongoId, displayName) => {
    if (!tenantMongoId) return
    try {
      // GET /tenants/:id — backend returns { tenant, stats }
      const res = await api.get(`/tenants/${tenantMongoId}`)
      // Interceptor unwraps response.data, so res is { tenant: {...}, stats: {...} }
      const tenant = res?.tenant || res?.data?.tenant || res
      if (tenant?.trial) {
        const now = new Date()
        const expired = tenant.trial.endDate && new Date(tenant.trial.endDate) < now
        const daysLeft = expired ? 0 : Math.ceil((new Date(tenant.trial.endDate) - now) / 86400000)
        setTrialStatus({ ...tenant.trial, expired, daysLeft, displayName: tenant.displayName || displayName })
      } else {
        setTrialStatus({ isActive: false, displayName: tenant?.displayName || displayName })
      }
    } catch {
      setTrialStatus({ isActive: false, displayName })
    }
  }, [])

  const handleSelectTenant = (e) => {
    const mongoId = e.target.value
    setSelected(mongoId || null)
    setTrialStatus(null)
    if (mongoId) {
      const t = tenants.find(t => (t._id || t.id) === mongoId)
      loadTrialStatus(mongoId, t?.displayName)
    }
  }

  /* Helper: get string tenantId from selected MongoDB _id */
  const getStringTenantId = () => {
    const t = tenants.find(t => (t._id || t.id) === selected)
    return t?.tenantId || selected
  }

  /* Actions */
  const startTrial = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const emails = startForm.invitedEmails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean)
      await api.post('/trial/start', {
        tenantId: getStringTenantId(),
        durationDays: Number(startForm.durationDays),
        maxUsers: Number(startForm.maxUsers),
        invitedEmails: emails,
      })
      flash('success', 'Trial started successfully! Invitation emails sent.')
      const t = tenants.find(t => (t._id || t.id) === selected)
      loadTrialStatus(selected, t?.displayName)
    } catch (err) {
      flash('error', err?.response?.data?.message || err?.message || 'Failed to start trial')
    } finally {
      setLoading(false)
    }
  }

  const inviteUsers = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const emails = inviteEmails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean)
      const res = await api.post('/trial/invite', { tenantId: getStringTenantId(), emails })
      flash('success', res?.message || `${emails.length} user(s) invited`)
      setInviteEmails('')
      const t = tenants.find(t => (t._id || t.id) === selected)
      loadTrialStatus(selected, t?.displayName)
    } catch (err) {
      flash('error', err?.response?.data?.message || err?.message || 'Failed to invite users')
    } finally {
      setLoading(false)
    }
  }

  const removeUser = async () => {
    if (!selected || !removeEmail.trim()) return
    setLoading(true)
    try {
      await api.delete('/trial/invite', { data: { tenantId: getStringTenantId(), email: removeEmail.trim() } })
      flash('success', `${removeEmail} removed from trial`)
      setRemoveEmail('')
      const t = tenants.find(t => (t._id || t.id) === selected)
      loadTrialStatus(selected, t?.displayName)
    } catch (err) {
      flash('error', err?.response?.data?.message || err?.message || 'Failed to remove user')
    } finally {
      setLoading(false)
    }
  }

  const extendTrial = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const res = await api.post('/trial/extend', { tenantId: getStringTenantId(), extraDays: Number(extraDays) })
      flash('success', res?.message || `Trial extended by ${extraDays} days`)
      const t = tenants.find(t => (t._id || t.id) === selected)
      loadTrialStatus(selected, t?.displayName)
    } catch (err) {
      flash('error', err?.response?.data?.message || err?.message || 'Failed to extend trial')
    } finally {
      setLoading(false)
    }
  }

  const convertTrial = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await api.post('/trial/convert', { tenantId: getStringTenantId(), contractTier })
      flash('success', `Trial converted to ${contractTier} plan!`)
      const t = tenants.find(t => (t._id || t.id) === selected)
      loadTrialStatus(selected, t?.displayName)
    } catch (err) {
      flash('error', err?.response?.data?.message || err?.message || 'Failed to convert trial')
    } finally {
      setLoading(false)
    }
  }

  /* ── render ── */
  const hasTrial = trialStatus?.isActive || trialStatus?.converted
  const isActive = trialStatus?.isActive && !trialStatus?.expired && !trialStatus?.converted

  return (
    <div style={{ fontFamily: "'DM Sans', 'Inter', sans-serif", maxWidth: 900 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a2e25', margin: 0 }}>
          Trial Management
        </h1>
        <p style={{ color: COLORS.muted, marginTop: 6, fontSize: 15 }}>
          Start, manage and convert 14-day trials for client organisations.
        </p>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 20,
          background: msg.type === 'success' ? '#e8f4f0' : '#fce8e8',
          border: `1px solid ${msg.type === 'success' ? '#4a9080' : COLORS.danger}`,
          color: msg.type === 'success' ? '#1a4a3a' : '#7a1a1a',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
        }}>
          {msg.type === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertTriangle size={16} />
          }
          {msg.text}
        </div>
      )}

      {/* Tenant selector */}
      <Card style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 8 }}>
          Select Organisation
        </label>
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: 400 }}>
          <select
            value={selected || ''}
            onChange={handleSelectTenant}
            style={{
              width: '100%', padding: '10px 36px 10px 14px', borderRadius: 8,
              border: '1.5px solid #e2eae7', fontSize: 14, appearance: 'none',
              background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              color: selected ? '#2d3748' : '#a0aec0',
            }}
          >
            <option value="">— choose a tenant —</option>
            {tenants.map(t => (
              <option key={t._id || t.id || t.tenantId} value={t._id || t.id}>
                {t.displayName || t.legalName} ({t.tenantId})
              </option>
            ))}
          </select>
          <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: COLORS.muted }} />
        </div>
      </Card>

      {/* Trial status summary */}
      {selected && trialStatus && (
        <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #f0f8f5 0%, #e8f4f0 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a2e25' }}>
              {trialStatus.displayName || selected}
            </span>
            {trialStatus.converted
              ? badge('Converted to Paid', '#4a9080')
              : isActive
              ? badge('Trial Active', '#4a9080')
              : trialStatus.isActive
              ? badge('Trial Expired', COLORS.danger)
              : badge('No Trial', COLORS.muted)
            }
          </div>

          {hasTrial && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {[
                { icon: <CalendarDays size={14} />, label: 'Start Date', val: fmt(trialStatus.startDate) },
                { icon: <CalendarDays size={14} />, label: 'End Date',   val: fmt(trialStatus.endDate) },
                { icon: <Clock size={14} />,        label: 'Days Left',  val: isActive ? trialStatus.daysLeft : 0 },
                { icon: <Users size={14} />,        label: 'Invited',    val: `${trialStatus.invitedEmails?.length || 0} / ${trialStatus.maxUsers || 20}` },
              ].map(({ icon, label, val }) => (
                <div key={label} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #e2eae7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>
                    {icon} {label}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2e25' }}>{val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Invited emails list */}
          {trialStatus.invitedEmails?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, marginBottom: 6 }}>INVITED USERS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trialStatus.invitedEmails.map(email => (
                  <span key={email} style={{
                    padding: '3px 10px', borderRadius: 99, fontSize: 12,
                    background: '#fff', border: '1px solid #c5dcd5', color: '#2d5a47',
                  }}>
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Actions section */}
      {selected && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Start trial */}
          {!hasTrial && (
            <Card style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#1a2e25', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Play size={16} color={COLORS.primary} /> Start 14-Day Trial
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <Field
                  label="Duration (days)"
                  type="number" min={1} max={90}
                  value={startForm.durationDays}
                  onChange={e => setStartForm(p => ({ ...p, durationDays: e.target.value }))}
                />
                <Field
                  label="Max invited users"
                  type="number" min={1} max={500}
                  value={startForm.maxUsers}
                  onChange={e => setStartForm(p => ({ ...p, maxUsers: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#4a5568' }}>
                  Invite emails (comma or newline separated)
                </label>
                <textarea
                  rows={3}
                  placeholder="hr@company.com, emp1@company.com, ..."
                  value={startForm.invitedEmails}
                  onChange={e => setStartForm(p => ({ ...p, invitedEmails: e.target.value }))}
                  style={{
                    padding: '8px 12px', borderRadius: 8,
                    border: '1.5px solid #e2eae7', fontSize: 14,
                    outline: 'none', fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
              </div>
              <Btn variant="primary" onClick={startTrial} loading={loading}>
                <Play size={14} /> Start Trial
              </Btn>
            </Card>
          )}

          {/* Invite more users */}
          {isActive && (
            <Card>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#1a2e25', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={15} color={COLORS.primary} /> Invite Users
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#4a5568' }}>
                  Emails (comma or newline)
                </label>
                <textarea
                  rows={3}
                  placeholder="user@company.com, ..."
                  value={inviteEmails}
                  onChange={e => setInviteEmails(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: 8,
                    border: '1.5px solid #e2eae7', fontSize: 14,
                    outline: 'none', fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
              </div>
              <Btn variant="primary" onClick={inviteUsers} loading={loading} disabled={!inviteEmails.trim()}>
                <UserPlus size={14} /> Send Invites
              </Btn>
            </Card>
          )}

          {/* Remove user */}
          {isActive && (
            <Card>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#1a2e25', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserMinus size={15} color={COLORS.danger} /> Remove User
              </h3>
              <Field
                label="Email to remove"
                placeholder="user@company.com"
                value={removeEmail}
                onChange={e => setRemoveEmail(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              <Btn variant="danger" onClick={removeUser} loading={loading} disabled={!removeEmail.trim()}>
                <UserMinus size={14} /> Remove
              </Btn>
            </Card>
          )}

          {/* Extend trial */}
          {(isActive || trialStatus?.expired) && !trialStatus?.converted && (
            <Card>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#1a2e25', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={15} color={COLORS.warn} /> Extend Trial
              </h3>
              <Field
                label="Extra days"
                type="number" min={1} max={90}
                value={extraDays}
                onChange={e => setExtraDays(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              <Btn variant="warn" onClick={extendTrial} loading={loading}>
                <Clock size={14} /> Extend
              </Btn>
            </Card>
          )}

          {/* Convert to paid */}
          {hasTrial && !trialStatus?.converted && (
            <Card>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#1a2e25', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={15} color={COLORS.accent} /> Convert to Paid
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#4a5568' }}>Contract tier</label>
                <select
                  value={contractTier}
                  onChange={e => setContractTier(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: 8,
                    border: '1.5px solid #e2eae7', fontSize: 14,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <Btn variant="accent" onClick={convertTrial} loading={loading}>
                <TrendingUp size={14} /> Convert to Paid
              </Btn>
            </Card>
          )}

          {/* Already converted */}
          {trialStatus?.converted && (
            <Card style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 32 }}>
              <CheckCircle2 size={40} color={COLORS.primary} style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: 18, color: '#1a2e25' }}>
                Successfully Converted to Paid!
              </div>
              <div style={{ color: COLORS.muted, marginTop: 6 }}>
                Converted on {fmt(trialStatus.convertedAt)}
              </div>
            </Card>
          )}
        </div>
      )}

      {!selected && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: COLORS.muted }}>
          <Users size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 16 }}>Select an organisation above to manage their trial</div>
        </div>
      )}
    </div>
  )
}
