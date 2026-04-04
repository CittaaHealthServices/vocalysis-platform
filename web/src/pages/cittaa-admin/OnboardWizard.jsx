import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Building2, MapPin, UserCog,
  CreditCard, ClipboardList, ChevronRight, ChevronLeft, Loader2,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

/* ── Static data ── */
const INDUSTRIES = [
  { value: 'technology',       label: 'Technology'           },
  { value: 'finance_banking',  label: 'Finance & Banking'    },
  { value: 'healthcare',       label: 'Healthcare'           },
  { value: 'manufacturing',    label: 'Manufacturing'        },
  { value: 'retail_ecommerce', label: 'Retail & E-commerce'  },
  { value: 'education',        label: 'Education'            },
  { value: 'logistics',        label: 'Logistics'            },
  { value: 'media',            label: 'Media & Entertainment'},
  { value: 'real_estate',      label: 'Real Estate'          },
  { value: 'pharma_biotech',   label: 'Pharma & Biotech'     },
  { value: 'consulting',       label: 'Consulting'           },
  { value: 'other',            label: 'Other'                },
]

const PLANS = [
  { value: 'starter',    label: 'Starter',      price: '₹29,000/mo', desc: 'Up to 100 employees · Core wellness tools'              },
  { value: 'professional', label: 'Professional', price: '₹79,000/mo', desc: 'Up to 500 employees · Advanced analytics + EAP'         },
  { value: 'enterprise', label: 'Enterprise',   price: 'Custom',     desc: 'Unlimited employees · Dedicated support + SLA'          },
]

const STEPS = [
  { label: 'Company Info',   icon: Building2     },
  { label: 'Location',       icon: MapPin        },
  { label: 'Admin Details',  icon: UserCog       },
  { label: 'Plan Selection', icon: CreditCard    },
  { label: 'Review',         icon: ClipboardList },
]

/* ── Tiny field components ── */
function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568' }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 12, color: '#c0544a', marginTop: 2 }}>{error}</span>}
    </div>
  )
}

function TInput({ label, error, value, onChange, ...rest }) {
  const [focused, setFocused] = useState(false)
  return (
    <Field label={label} error={error}>
      <input
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 14, width: '100%',
          border: `1.5px solid ${error ? '#c0544a' : focused ? '#4a9080' : '#e2eae7'}`,
          outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          background: '#fff', transition: 'border-color .15s',
        }}
        {...rest}
      />
    </Field>
  )
}

function SInput({ label, error, value, onChange, options }) {
  return (
    <Field label={label} error={error}>
      <select
        value={value}
        onChange={onChange}
        style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 14, width: '100%',
          border: `1.5px solid ${error ? '#c0544a' : '#e2eae7'}`,
          outline: 'none', fontFamily: 'inherit', background: '#fff',
          cursor: 'pointer', appearance: 'auto',
        }}
      >
        <option value="">— select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  )
}

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */
export const OnboardWizard = () => {
  const navigate   = useNavigate()
  const [step, setStep]         = useState(0)
  const [submitting, setSubmitting] = useState(false)

  /* All field values in a single state object */
  const [vals, setVals] = useState({
    companyName: '', industry: '', employeeCount: '',
    country: '', city: '',
    adminName: '', adminEmail: '',
    tier: '',
  })

  /* Per-field error messages */
  const [errs, setErrs] = useState({})

  const set = (field) => (e) => {
    const val = e.target.value
    setVals(v => ({ ...v, [field]: val }))
    /* clear the error for this field as soon as user types */
    if (errs[field]) setErrs(e => ({ ...e, [field]: '' }))
  }

  /* ── Per-step validation ── */
  const validate = (s) => {
    const e = {}
    if (s === 0) {
      if (!vals.companyName.trim() || vals.companyName.trim().length < 3)
        e.companyName = 'Company name must be at least 3 characters'
      if (!vals.industry)
        e.industry = 'Please select an industry'
      if (!vals.employeeCount || isNaN(Number(vals.employeeCount)) || Number(vals.employeeCount) < 1)
        e.employeeCount = 'Enter a valid employee count'
    }
    if (s === 1) {
      if (!vals.country.trim()) e.country = 'Country is required'
      if (!vals.city.trim())    e.city    = 'City is required'
    }
    if (s === 2) {
      if (!vals.adminName.trim() || vals.adminName.trim().length < 2)
        e.adminName  = 'Admin name is required'
      if (!vals.adminEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals.adminEmail))
        e.adminEmail = 'Please enter a valid email address'
    }
    if (s === 3) {
      if (!vals.tier) e.tier = 'Please select a plan'
    }
    return e
  }

  const handleNext = () => {
    const e = validate(step)
    if (Object.keys(e).length > 0) { setErrs(e); return }
    setErrs({})
    setStep(s => s + 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    /* Validate all steps before submitting */
    for (let s = 0; s < 4; s++) {
      const stepErrs = validate(s)
      if (Object.keys(stepErrs).length > 0) {
        setErrs(stepErrs)
        setStep(s)
        toast.error('Please fix the highlighted fields')
        return
      }
    }
    setSubmitting(true)
    try {
      // Split "Full Name" into first / last for the backend
      const nameParts     = vals.adminName.trim().split(/\s+/)
      const adminFirstName = nameParts[0] || vals.adminName.trim()
      const adminLastName  = nameParts.slice(1).join(' ') || '—'

      await api.post('/tenants', {
        name:           vals.companyName.trim(),   // backend expects `name`
        industry:       vals.industry,
        employeeCount:  Number(vals.employeeCount),
        country:        vals.country.trim(),
        city:           vals.city.trim(),
        adminFirstName,
        adminLastName,
        adminEmail:     vals.adminEmail.trim(),
        tier:           vals.tier,
        status:         'active',
      })
      toast.success(`${vals.companyName} onboarded successfully!`)
      navigate('/cittaa-admin/tenants')
    } catch (err) {
      const msg = err?.error?.message || err?.message || 'Onboarding failed — please try again'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Styles ── */
  const S = {
    card:    { background: '#fff', borderRadius: 14, border: '1px solid #e2eae7', padding: '32px 36px', boxShadow: '0 2px 8px rgba(0,0,0,.05)', marginBottom: 24 },
    grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
    heading: { fontSize: 20, fontWeight: 700, color: '#1a2e25', margin: '0 0 20px 0' },
    btn:     { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', transition: 'opacity .15s' },
    review:  { background: '#f3f7f5', borderRadius: 10, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 },
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Progress bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        {STEPS.map(({ label }, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: i <= step ? '#4a9080' : '#e2eae7',
                color: i <= step ? '#fff' : '#718096', fontWeight: 700, fontSize: 13,
                transition: 'background .2s',
              }}>
                {i < step ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', color: i <= step ? '#4a9080' : '#a0aec0' }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < step ? '#4a9080' : '#e2eae7', margin: '0 6px', marginBottom: 18, transition: 'background .2s' }} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={S.card}>

          {/* Step 0 — Company Info */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={S.heading}>Company Information</h2>
              <TInput
                label="Company / Organisation Name *"
                placeholder="e.g. Acme Technologies Pvt Ltd"
                value={vals.companyName}
                onChange={set('companyName')}
                error={errs.companyName}
              />
              <div style={S.grid2}>
                <SInput
                  label="Industry *"
                  options={INDUSTRIES}
                  value={vals.industry}
                  onChange={set('industry')}
                  error={errs.industry}
                />
                <TInput
                  label="Number of Employees *"
                  type="number"
                  placeholder="e.g. 250"
                  value={vals.employeeCount}
                  onChange={set('employeeCount')}
                  error={errs.employeeCount}
                />
              </div>
            </div>
          )}

          {/* Step 1 — Location */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={S.heading}>Office Location</h2>
              <div style={S.grid2}>
                <TInput
                  label="Country *"
                  placeholder="e.g. India"
                  value={vals.country}
                  onChange={set('country')}
                  error={errs.country}
                />
                <TInput
                  label="City *"
                  placeholder="e.g. Bengaluru"
                  value={vals.city}
                  onChange={set('city')}
                  error={errs.city}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Admin */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={S.heading}>Company Administrator</h2>
              <p style={{ margin: '0 0 4px', color: '#718096', fontSize: 14 }}>
                This person will manage the company account and invite employees.
              </p>
              <TInput
                label="Full Name *"
                placeholder="e.g. Priya Sharma"
                value={vals.adminName}
                onChange={set('adminName')}
                error={errs.adminName}
              />
              <TInput
                label="Work Email *"
                type="email"
                placeholder="e.g. priya@acme.com"
                value={vals.adminEmail}
                onChange={set('adminEmail')}
                error={errs.adminEmail}
              />
            </div>
          )}

          {/* Step 3 — Plan */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={S.heading}>Choose a Plan</h2>
              {errs.tier && <span style={{ fontSize: 12, color: '#c0544a' }}>{errs.tier}</span>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PLANS.map(plan => {
                  const sel = vals.tier === plan.value
                  return (
                    <label key={plan.value} style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                      borderRadius: 10, border: `2px solid ${sel ? '#4a9080' : '#e2eae7'}`,
                      background: sel ? '#f0f8f5' : '#fff', cursor: 'pointer', transition: 'all .15s',
                    }}>
                      <input
                        type="radio"
                        name="tier"
                        value={plan.value}
                        checked={sel}
                        onChange={set('tier')}
                        style={{ accentColor: '#4a9080', width: 18, height: 18, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#1a2e25', fontSize: 15 }}>{plan.label}</div>
                        <div style={{ color: '#718096', fontSize: 13, marginTop: 2 }}>{plan.desc}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#4a9080', fontSize: 15, whiteSpace: 'nowrap' }}>{plan.price}</div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 4 && (
            <div>
              <h2 style={S.heading}>Review & Confirm</h2>
              <p style={{ margin: '0 0 16px', color: '#718096', fontSize: 14 }}>
                Check everything below before completing onboarding.
              </p>
              <div style={S.review}>
                {[
                  { label: 'Company',     val: vals.companyName },
                  { label: 'Industry',    val: INDUSTRIES.find(i => i.value === vals.industry)?.label },
                  { label: 'Employees',   val: vals.employeeCount },
                  { label: 'Location',    val: vals.city && vals.country ? `${vals.city}, ${vals.country}` : '' },
                  { label: 'Admin Name',  val: vals.adminName },
                  { label: 'Admin Email', val: vals.adminEmail },
                  { label: 'Plan',        val: PLANS.find(p => p.value === vals.tier)?.label },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: 'flex', gap: 12, fontSize: 14, alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, color: '#4a5568', minWidth: 110, flexShrink: 0 }}>{label}</span>
                    <span style={{ color: val ? '#1a2e25' : '#c0544a', fontWeight: val ? 400 : 600 }}>
                      {val || '⚠ missing — go back and fill this in'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => { setErrs({}); setStep(s => s - 1) }}
            disabled={step === 0}
            style={{
              ...S.btn,
              background: '#fff', color: step === 0 ? '#c0c9d0' : '#4a5568',
              border: '1.5px solid #e2eae7',
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              style={{ ...S.btn, background: '#4a9080', color: '#fff', border: 'none' }}
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              style={{ ...S.btn, background: '#4a9080', color: '#fff', border: 'none', opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting
                ? <><Loader2 size={15} style={{ animation: 'spin .7s linear infinite' }} /> Onboarding…</>
                : 'Complete Onboarding'
              }
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default OnboardWizard
