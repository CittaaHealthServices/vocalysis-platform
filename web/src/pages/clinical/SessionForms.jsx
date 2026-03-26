/**
 * SessionForms.jsx — Pre-session and Post-session forms for psychologists
 * Accessed at /clinical/session-forms
 */
import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { ClipboardList, ChevronDown, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

// ──────────────────────────────────────────────────────────────────────────────
// FIELD COMPONENTS
// ──────────────────────────────────────────────────────────────────────────────
const Field = ({ label, error, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
)

const TInput = ({ value, onChange, placeholder, type = 'text', error, ...props }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition ${
      error ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`}
    {...props}
  />
)

const TSelect = ({ value, onChange, options, error, placeholder }) => (
  <select
    value={value}
    onChange={onChange}
    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${
      error ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(o => (
      <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
    ))}
  </select>
)

const TTextarea = ({ value, onChange, placeholder, rows = 3, error }) => (
  <textarea
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none ${
      error ? 'border-red-400 bg-red-50' : 'border-gray-200'
    }`}
  />
)

const RatingSlider = ({ value, onChange, min = 1, max = 10, label }) => (
  <div>
    <div className="flex justify-between text-xs text-gray-400 mb-1">
      <span>{min} (Low)</span>
      <span className="font-semibold text-violet-600 text-sm">{value || '—'}</span>
      <span>{max} (High)</span>
    </div>
    <input
      type="range" min={min} max={max} value={value || min}
      onChange={onChange}
      className="w-full accent-violet-600"
    />
  </div>
)

// ──────────────────────────────────────────────────────────────────────────────
// PRE-SESSION FORM
// ──────────────────────────────────────────────────────────────────────────────
const PRE_EMPTY = {
  sessionId: '',
  currentMoodScore: 5, currentStressLevel: 5, sleepQuality: '', sleepHours: '',
  energyLevel: 5, anxietyLevel: 5, mainConcern: '', recentLifeEvents: '',
  medicationChanges: 'no', physicalSymptoms: '', suicidalIdeation: false,
  sessionGoal: '', safetyCheck: 'safe',
}

function PreSessionForm() {
  const [vals, setVals] = useState(PRE_EMPTY)
  const [errs, setErrs] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const set = (f) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setVals(v => ({ ...v, [f]: val }))
    if (errs[f]) setErrs(e => ({ ...e, [f]: '' }))
  }
  const setNum = (f) => (e) => setVals(v => ({ ...v, [f]: Number(e.target.value) }))

  const validate = () => {
    const e = {}
    if (!vals.sessionId.trim()) e.sessionId = 'Session ID is required'
    if (!vals.mainConcern.trim()) e.mainConcern = 'Please describe the main concern'
    if (!vals.sessionGoal.trim()) e.sessionGoal = 'Session goal is required'
    if (!vals.sleepQuality) e.sleepQuality = 'Sleep quality is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) { setErrs(errors); return }
    setSaving(true)
    try {
      await api.post(`/clinical/sessions/${vals.sessionId}/pre-form`, vals)
      toast.success('Pre-session form submitted')
      setDone(true)
      setVals(PRE_EMPTY)
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to save form')
    } finally {
      setSaving(false)
    }
  }

  if (done) return (
    <div className="text-center py-12">
      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
      <p className="text-lg font-semibold text-gray-800">Pre-session form saved</p>
      <Button variant="secondary" className="mt-4" onClick={() => setDone(false)}>Fill another</Button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        Complete this form <strong>before</strong> the session begins. Helps establish baseline and session goals.
      </div>

      <Field label="Session ID" required error={errs.sessionId} hint="Enter the session or consultation ID from the patient record">
        <TInput value={vals.sessionId} onChange={set('sessionId')} placeholder="e.g. 65ab3c..." error={errs.sessionId} />
      </Field>

      {/* Mood & Stress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Current Mood Score (1–10)" required>
          <RatingSlider value={vals.currentMoodScore} onChange={setNum('currentMoodScore')} />
        </Field>
        <Field label="Stress Level (1–10)" required>
          <RatingSlider value={vals.currentStressLevel} onChange={setNum('currentStressLevel')} />
        </Field>
        <Field label="Anxiety Level (1–10)" required>
          <RatingSlider value={vals.anxietyLevel} onChange={setNum('anxietyLevel')} />
        </Field>
        <Field label="Energy Level (1–10)" required>
          <RatingSlider value={vals.energyLevel} onChange={setNum('energyLevel')} />
        </Field>
      </div>

      {/* Sleep */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Sleep Quality Last Night" required error={errs.sleepQuality}>
          <TSelect value={vals.sleepQuality} onChange={set('sleepQuality')} error={errs.sleepQuality} placeholder="Select…"
            options={['Very poor','Poor','Fair','Good','Very good']} />
        </Field>
        <Field label="Hours of Sleep" hint="Approximate">
          <TInput type="number" min="0" max="24" value={vals.sleepHours} onChange={set('sleepHours')} placeholder="e.g. 7" />
        </Field>
      </div>

      {/* Main concern */}
      <Field label="Main Concern / Presenting Issue" required error={errs.mainConcern}>
        <TTextarea value={vals.mainConcern} onChange={set('mainConcern')} error={errs.mainConcern}
          placeholder="What is the client's primary concern coming into today's session?" rows={3} />
      </Field>

      {/* Recent life events */}
      <Field label="Recent Significant Life Events" hint="Any major changes, stressors, or events since last session">
        <TTextarea value={vals.recentLifeEvents} onChange={set('recentLifeEvents')}
          placeholder="e.g. Promotion, relationship change, bereavement, relocation…" rows={2} />
      </Field>

      {/* Medication */}
      <Field label="Medication Changes Since Last Session" required>
        <TSelect value={vals.medicationChanges} onChange={set('medicationChanges')}
          options={[{ value: 'no', label: 'No changes' }, { value: 'new', label: 'New medication started' }, { value: 'changed', label: 'Dosage changed' }, { value: 'stopped', label: 'Medication stopped' }]} />
      </Field>

      {/* Physical symptoms */}
      <Field label="Physical Symptoms Reported" hint="Headaches, fatigue, palpitations, etc.">
        <TInput value={vals.physicalSymptoms} onChange={set('physicalSymptoms')}
          placeholder="e.g. Fatigue, difficulty concentrating, chest tightness" />
      </Field>

      {/* Safety */}
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-red-700">Safety Screening</p>
        <Field label="Current Safety Status" required>
          <TSelect value={vals.safetyCheck} onChange={set('safetyCheck')}
            options={[
              { value: 'safe', label: '✅ Safe — no current ideation' },
              { value: 'passive', label: '⚠️ Passive ideation present' },
              { value: 'active', label: '🚨 Active ideation — safety plan needed' },
              { value: 'risk_discussed', label: '📋 Risk discussed and safety plan reviewed' },
            ]} />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={vals.suicidalIdeation} onChange={set('suicidalIdeation')} className="rounded" />
          <span className="text-sm text-gray-700">Client has expressed suicidal ideation this session</span>
        </label>
      </div>

      {/* Session goal */}
      <Field label="Session Goal / Objectives" required error={errs.sessionGoal}>
        <TTextarea value={vals.sessionGoal} onChange={set('sessionGoal')} error={errs.sessionGoal}
          placeholder="What do you aim to achieve in today's session?" rows={2} />
      </Field>

      <Button type="submit" variant="primary" className="w-full" loading={saving}>
        Submit Pre-Session Form
      </Button>
    </form>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// POST-SESSION FORM
// ──────────────────────────────────────────────────────────────────────────────
const THERAPEUTIC_APPROACHES = [
  'Cognitive Behavioral Therapy (CBT)',
  'Dialectical Behavior Therapy (DBT)',
  'Psychodynamic Therapy',
  'Person-Centred Therapy',
  'Solution-Focused Brief Therapy (SFBT)',
  'Acceptance & Commitment Therapy (ACT)',
  'EMDR',
  'Motivational Interviewing',
  'Mindfulness-Based Therapy',
  'Trauma-Focused CBT',
  'Integrative / Eclectic',
  'Other',
]

const SESSION_TYPES = [
  'Individual Therapy', 'Couples Therapy', 'Family Therapy', 'Group Therapy',
  'Crisis Intervention', 'Assessment / Intake', 'Follow-up Review', 'Discharge Session',
]

const POST_EMPTY = {
  sessionId: '', sessionType: '', sessionDuration: '',
  presentingIssues: '', therapeuticApproach: '', patientEngagement: '3',
  progressNotes: '', clinicalObservations: '',
  riskAssessment: '', riskLevel: 'low', safetyPlan: '',
  diagnosisCodes: '', treatmentGoals: '', nextSteps: '',
  followUpRequired: false, followUpTimeframe: '', referralNeeded: false,
  sessionRating: '4', clinicianNotes: '',
  postMoodScore: 5, postStressLevel: 5, sessionHelpfulness: '4', patientFeedback: '',
}

function PostSessionForm() {
  const [vals, setVals] = useState(POST_EMPTY)
  const [errs, setErrs] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const set = (f) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setVals(v => ({ ...v, [f]: val }))
    if (errs[f]) setErrs(e => ({ ...e, [f]: '' }))
  }
  const setNum = (f) => (e) => setVals(v => ({ ...v, [f]: Number(e.target.value) }))

  const validate = () => {
    const e = {}
    if (!vals.sessionId.trim())        e.sessionId        = 'Session ID is required'
    if (!vals.sessionType)             e.sessionType      = 'Session type is required'
    if (!vals.presentingIssues.trim()) e.presentingIssues = 'Required'
    if (!vals.progressNotes.trim())    e.progressNotes    = 'Required'
    if (!vals.riskAssessment.trim())   e.riskAssessment   = 'Required'
    if (!vals.nextSteps.trim())        e.nextSteps        = 'Required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) { setErrs(errors); return }
    setSaving(true)
    try {
      await api.post(`/clinical/sessions/${vals.sessionId}/post-form`, vals)
      toast.success('Post-session form submitted')
      setDone(true)
      setVals(POST_EMPTY)
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to save form')
    } finally {
      setSaving(false)
    }
  }

  if (done) return (
    <div className="text-center py-12">
      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
      <p className="text-lg font-semibold text-gray-800">Post-session form saved & session marked complete</p>
      <Button variant="secondary" className="mt-4" onClick={() => setDone(false)}>Fill another</Button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
        Complete this form <strong>after</strong> the session. This will mark the session as completed.
      </div>

      <Field label="Session ID" required error={errs.sessionId}>
        <TInput value={vals.sessionId} onChange={set('sessionId')} placeholder="Session / consultation ID" error={errs.sessionId} />
      </Field>

      {/* Session basics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Session Type" required error={errs.sessionType}>
          <TSelect value={vals.sessionType} onChange={set('sessionType')} error={errs.sessionType}
            placeholder="Select type…" options={SESSION_TYPES} />
        </Field>
        <Field label="Session Duration (minutes)" hint="Actual time spent">
          <TInput type="number" min="5" max="240" value={vals.sessionDuration} onChange={set('sessionDuration')} placeholder="e.g. 50" />
        </Field>
      </div>

      {/* Therapeutic approach */}
      <Field label="Primary Therapeutic Approach Used">
        <TSelect value={vals.therapeuticApproach} onChange={set('therapeuticApproach')}
          placeholder="Select approach…" options={THERAPEUTIC_APPROACHES} />
      </Field>

      {/* Patient engagement */}
      <Field label="Patient Engagement Level (1 = minimal, 5 = highly engaged)">
        <TSelect value={vals.patientEngagement} onChange={set('patientEngagement')}
          options={['1','2','3','4','5'].map(v => ({ value: v, label: `${v} — ${{ '1': 'Minimal', '2': 'Low', '3': 'Moderate', '4': 'Good', '5': 'Highly engaged' }[v]}` }))} />
      </Field>

      {/* Clinical notes */}
      <Field label="Presenting Issues Addressed" required error={errs.presentingIssues}>
        <TTextarea value={vals.presentingIssues} onChange={set('presentingIssues')} error={errs.presentingIssues}
          placeholder="List the main issues discussed during this session" rows={3} />
      </Field>

      <Field label="Progress Notes" required error={errs.progressNotes}>
        <TTextarea value={vals.progressNotes} onChange={set('progressNotes')} error={errs.progressNotes}
          placeholder="Progress towards treatment goals, new insights, breakthroughs, or setbacks…" rows={4} />
      </Field>

      <Field label="Clinical Observations">
        <TTextarea value={vals.clinicalObservations} onChange={set('clinicalObservations')}
          placeholder="Affect, behaviour, cognition, appearance, speech patterns…" rows={3} />
      </Field>

      {/* Risk assessment */}
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-red-700">Risk Assessment</p>
        <Field label="Risk Summary" required error={errs.riskAssessment}>
          <TTextarea value={vals.riskAssessment} onChange={set('riskAssessment')} error={errs.riskAssessment}
            placeholder="Suicidality, self-harm, harm to others, substance use risk…" rows={2} />
        </Field>
        <Field label="Overall Risk Level" required>
          <TSelect value={vals.riskLevel} onChange={set('riskLevel')}
            options={[
              { value: 'low',    label: '🟢 Low — no significant risk factors' },
              { value: 'medium', label: '🟡 Medium — some risk factors, monitoring needed' },
              { value: 'high',   label: '🔴 High — immediate action / safety plan required' },
            ]} />
        </Field>
        <Field label="Safety Plan" hint="Required if risk level is Medium or High">
          <TTextarea value={vals.safetyPlan} onChange={set('safetyPlan')}
            placeholder="Details of the safety plan discussed with client…" rows={2} />
        </Field>
      </div>

      {/* Diagnosis & treatment */}
      <Field label="Diagnosis Codes (ICD-10 / DSM-5)" hint="e.g. F32.1, F41.1 — comma-separated">
        <TInput value={vals.diagnosisCodes} onChange={set('diagnosisCodes')} placeholder="e.g. F32.1, F41.1" />
      </Field>

      <Field label="Treatment Goals Updated">
        <TTextarea value={vals.treatmentGoals} onChange={set('treatmentGoals')}
          placeholder="Short-term and long-term therapeutic goals…" rows={2} />
      </Field>

      {/* Next steps */}
      <Field label="Next Steps / Homework" required error={errs.nextSteps}>
        <TTextarea value={vals.nextSteps} onChange={set('nextSteps')} error={errs.nextSteps}
          placeholder="Tasks, exercises, or goals for the client before the next session…" rows={2} />
      </Field>

      {/* Follow-up & referral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={vals.followUpRequired} onChange={set('followUpRequired')} className="rounded" />
            <span className="text-sm font-medium text-gray-700">Follow-up session required</span>
          </label>
          {vals.followUpRequired && (
            <TSelect value={vals.followUpTimeframe} onChange={set('followUpTimeframe')}
              placeholder="Follow-up timeframe…"
              options={['1 week', '2 weeks', '1 month', '3 months', 'As needed']} />
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={vals.referralNeeded} onChange={set('referralNeeded')} className="rounded" />
            <span className="text-sm font-medium text-gray-700">Referral to another specialist needed</span>
          </label>
        </div>
      </div>

      {/* Session quality */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Session Quality (Clinician Self-Evaluation)</p>
        <Field label="Session Effectiveness Rating (1–5)">
          <TSelect value={vals.sessionRating} onChange={set('sessionRating')}
            options={[
              { value: '1', label: '1 — Difficult session, minimal progress' },
              { value: '2', label: '2 — Some challenges, limited progress' },
              { value: '3', label: '3 — Adequate session, moderate progress' },
              { value: '4', label: '4 — Good session, clear progress' },
              { value: '5', label: '5 — Excellent session, significant breakthrough' },
            ]} />
        </Field>
        <div className="mt-3">
          <Field label="Private Clinician Notes" hint="Not shared with client — for supervision purposes">
            <TTextarea value={vals.clinicianNotes} onChange={set('clinicianNotes')}
              placeholder="Personal observations, countertransference, supervision topics…" rows={2} />
          </Field>
        </div>
      </div>

      {/* Client self-report */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Client Self-Report (Post-Session)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Post-Session Mood (1–10)">
            <RatingSlider value={vals.postMoodScore} onChange={setNum('postMoodScore')} />
          </Field>
          <Field label="Post-Session Stress (1–10)">
            <RatingSlider value={vals.postStressLevel} onChange={setNum('postStressLevel')} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Session Helpfulness (1–5, client-reported)">
            <TSelect value={vals.sessionHelpfulness} onChange={set('sessionHelpfulness')}
              options={['1','2','3','4','5'].map(v => ({ value: v, label: v }))} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Client Feedback / Verbal Report">
            <TTextarea value={vals.patientFeedback} onChange={set('patientFeedback')}
              placeholder="What did the client say about the session? Any concerns or positive feedback…" rows={2} />
          </Field>
        </div>
      </div>

      <Button type="submit" variant="primary" className="w-full" loading={saving}>
        Submit Post-Session Form & Complete Session
      </Button>
    </form>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────
export const SessionForms = () => {
  const [activeTab, setActiveTab] = useState('pre')

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-app">Session Forms</h1>
        <p className="text-sm text-gray-500 mt-1">
          Complete the appropriate form before or after each therapy session
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('pre')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'pre'
              ? 'bg-white text-violet-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" /> Pre-Session Form
        </button>
        <button
          onClick={() => setActiveTab('post')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'post'
              ? 'bg-white text-violet-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Post-Session Form
        </button>
      </div>

      <Card className="p-6">
        {activeTab === 'pre'  && <PreSessionForm />}
        {activeTab === 'post' && <PostSessionForm />}
      </Card>
    </div>
  )
}

export default SessionForms
