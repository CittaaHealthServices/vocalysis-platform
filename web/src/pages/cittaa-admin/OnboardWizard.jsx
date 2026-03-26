import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Building2, MapPin, UserCog, CreditCard, ClipboardList, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

/* ── Validation schema ── */
const schema = z.object({
  companyName:   z.string().min(3,  'Company name must be at least 3 characters'),
  industry:      z.string().min(1,  'Please select an industry'),
  employeeCount: z.string().min(1,  'Employee count is required'),
  country:       z.string().min(1,  'Country is required'),
  city:          z.string().min(1,  'City is required'),
  adminName:     z.string().min(2,  'Admin name is required'),
  adminEmail:    z.string().email('Please enter a valid email address'),
  tier:          z.string().min(1,  'Please select a plan'),
})

/* Fields validated per step — so Next only checks the current step */
const STEP_FIELDS = [
  ['companyName', 'industry', 'employeeCount'],
  ['country', 'city'],
  ['adminName', 'adminEmail'],
  ['tier'],
]

const STEPS = [
  { label: 'Company Info',   icon: Building2     },
  { label: 'Location',       icon: MapPin        },
  { label: 'Admin Details',  icon: UserCog       },
  { label: 'Plan Selection', icon: CreditCard    },
  { label: 'Review',         icon: ClipboardList },
]

const INDUSTRIES = [
  { value: 'technology',         label: 'Technology'            },
  { value: 'finance_banking',    label: 'Finance & Banking'     },
  { value: 'healthcare',         label: 'Healthcare'            },
  { value: 'manufacturing',      label: 'Manufacturing'         },
  { value: 'retail_ecommerce',   label: 'Retail & E-commerce'   },
  { value: 'education',          label: 'Education'             },
  { value: 'logistics',          label: 'Logistics'             },
  { value: 'media',              label: 'Media & Entertainment' },
  { value: 'real_estate',        label: 'Real Estate'           },
  { value: 'pharma_biotech',     label: 'Pharma & Biotech'      },
  { value: 'consulting',         label: 'Consulting'            },
  { value: 'other',              label: 'Other'                 },
]

const PLANS = [
  { value: 'starter',    label: 'Starter',       price: '₹29,000/mo',  desc: 'Up to 100 employees · Core wellness tools' },
  { value: 'pro',        label: 'Professional',  price: '₹79,000/mo',  desc: 'Up to 500 employees · Advanced analytics + EAP' },
  { value: 'enterprise', label: 'Enterprise',    price: 'Custom',      desc: 'Unlimited employees · Dedicated support + SLA' },
]

/* ── Field components ── */
function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568' }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 12, color: '#c0544a', marginTop: 2 }}>{error}</span>}
    </div>
  )
}

function TextInput({ label, error, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <Field label={label} error={error}>
      <input
        {...props}
        onFocus={e => { setFocused(true); props.onFocus?.(e) }}
        onBlur={e => { setFocused(false); props.onBlur?.(e) }}
        style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 14, width: '100%',
          border: `1.5px solid ${error ? '#c0544a' : focused ? '#4a9080' : '#e2eae7'}`,
          outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          background: '#fff', transition: 'border-color .15s',
        }}
      />
    </Field>
  )
}

function SelectInput({ label, error, options, ...props }) {
  return (
    <Field label={label} error={error}>
      <select
        {...props}
        style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 14, width: '100%',
          border: `1.5px solid ${error ? '#c0544a' : '#e2eae7'}`,
          outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer',
        }}
      >
        <option value="">— select —</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
export const OnboardWizard = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    // IMPORTANT: preserve values when steps unmount
    shouldUnregister: false,
    defaultValues: {
      companyName: '', industry: '', employeeCount: '',
      country: '', city: '', adminName: '', adminEmail: '', tier: '',
    },
  })

  const values = watch()

  const handleNext = async () => {
    const valid = await trigger(STEP_FIELDS[step])
    if (valid) setStep(s => s + 1)
  }

  const onSubmit = async (data) => {
    setSubmitting(true)
    try {
      await api.post('/tenants', {
        displayName:   data.companyName,
        legalName:     data.companyName,
        industry:      data.industry,
        employeeCount: Number(data.employeeCount),
        country:       data.country,
        city:          data.city,
        adminName:     data.adminName,
        adminEmail:    data.adminEmail,
        tier:          data.tier,
        status:        'active',
      })
      toast.success(`${data.companyName} onboarded successfully!`)
      navigate('/cittaa-admin/tenants')
    } catch (err) {
      toast.error(err?.error?.message || 'Onboarding failed — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const S = {
    card:    { background: '#fff', borderRadius: 14, border: '1px solid #e2eae7', padding: '32px 36px', boxShadow: '0 2px 8px rgba(0,0,0,.05)', marginBottom: 24 },
    grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
    heading: { fontSize: 20, fontWeight: 700, color: '#1a2e25', margin: '0 0 20px 0' },
    btnBase: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', transition: 'opacity .15s' },
    review:  { background: '#f3f7f5', borderRadius: 10, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 },
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, gap: 0 }}>
        {STEPS.map(({ label }, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i <= step ? '#4a9080' : '#e2eae7',
                color: i <= step ? '#fff' : '#718096', fontWeight: 700, fontSize: 13,
                transition: 'background .2s',
              }}>
                {i < step ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: i === step ? '#4a9080' : i < step ? '#4a9080' : '#a0aec0', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < step ? '#4a9080' : '#e2eae7', margin: '0 6px', marginBottom: 18, transition: 'background .2s' }} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={S.card}>

          {/* ── Step 0: Company Info ── */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={S.heading}>Company Information</h2>
              <TextInput
                label="Company / Organisation Name *"
                placeholder="e.g. Acme Technologies Pvt Ltd"
                error={errors.companyName?.message}
                {...register('companyName')}
              />
              <div style={S.grid2}>
                <SelectInput
                  label="Industry *"
                  options={INDUSTRIES}
                  error={errors.industry?.message}
                  {...register('industry')}
                />
                <TextInput
                  label="Number of Employees *"
                  type="number"
                  placeholder="e.g. 250"
                  error={errors.employeeCount?.message}
                  {...register('employeeCount')}
                />
              </div>
            </div>
          )}

          {/* ── Step 1: Location ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={S.heading}>Office Location</h2>
              <div style={S.grid2}>
                <TextInput
                  label="Country *"
                  placeholder="e.g. India"
                  error={errors.country?.message}
                  {...register('country')}
                />
                <TextInput
                  label="City *"
                  placeholder="e.g. Bengaluru"
                  error={errors.city?.message}
                  {...register('city')}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Admin Details ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={S.heading}>Company Administrator</h2>
              <p style={{ margin: '0 0 4px', color: '#718096', fontSize: 14 }}>
                This person will manage the company account and invite employees.
              </p>
              <TextInput
                label="Full Name *"
                placeholder="e.g. Priya Sharma"
                error={errors.adminName?.message}
                {...register('adminName')}
              />
              <TextInput
                label="Work Email *"
                type="email"
                placeholder="e.g. priya@acme.com"
                error={errors.adminEmail?.message}
                {...register('adminEmail')}
              />
            </div>
          )}

          {/* ── Step 3: Plan ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={S.heading}>Choose a Plan</h2>
              {errors.tier && <span style={{ fontSize: 12, color: '#c0544a' }}>{errors.tier.message}</span>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PLANS.map(plan => {
                  const sel = values.tier === plan.value
                  return (
                    <label key={plan.value} style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                      borderRadius: 10, border: `2px solid ${sel ? '#4a9080' : '#e2eae7'}`,
                      background: sel ? '#f0f8f5' : '#fff', cursor: 'pointer', transition: 'all .15s',
                    }}>
                      <input type="radio" value={plan.value} {...register('tier')} style={{ accentColor: '#4a9080', width: 18, height: 18, flexShrink: 0 }} />
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

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <div>
              <h2 style={S.heading}>Review & Confirm</h2>
              <p style={{ margin: '0 0 16px', color: '#718096', fontSize: 14 }}>Please check the details before completing onboarding.</p>
              <div style={S.review}>
                {[
                  { label: 'Company',     val: values.companyName },
                  { label: 'Industry',    val: INDUSTRIES.find(i => i.value === values.industry)?.label },
                  { label: 'Employees',   val: values.employeeCount },
                  { label: 'Location',    val: values.city && values.country ? `${values.city}, ${values.country}` : null },
                  { label: 'Admin Name',  val: values.adminName },
                  { label: 'Admin Email', val: values.adminEmail },
                  { label: 'Plan',        val: PLANS.find(p => p.value === values.tier)?.label },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: 'flex', gap: 12, fontSize: 14, color: '#2d3748', alignItems: 'flex-start' }}>
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
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            style={{
              ...S.btnBase,
              background: '#fff', color: step === 0 ? '#c0c9d0' : '#4a5568',
              border: '1.5px solid #e2eae7',
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext} style={{ ...S.btnBase, background: '#4a9080', color: '#fff' }}>
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              style={{ ...S.btnBase, background: '#4a9080', color: '#fff', opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
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
