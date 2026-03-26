import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Button, Input, LoadingScreen, Modal } from '../../components/ui'
import { Brain, Plus, Trash2, User, CheckCircle2 } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const ROLE_LABELS = {
  CLINICAL_PSYCHOLOGIST: 'Clinical Psychologist',
  SENIOR_CLINICIAN:      'Senior Clinician',
}

const SPECIALISATIONS = [
  'Clinical Psychology',
  'Cognitive Behavioral Therapy (CBT)',
  'Dialectical Behavior Therapy (DBT)',
  'Trauma-Focused Therapy',
  'Child & Adolescent Psychology',
  'Occupational Psychology',
  'Neuropsychology',
  'Grief & Loss Counselling',
  'Relationship Therapy',
  'Stress & Burnout Management',
  'Other',
]

const EMPTY = {
  firstName: '', lastName: '', email: '', password: '',
  role: 'CLINICAL_PSYCHOLOGIST', tenantId: '',
  rciRegistrationNumber: '', specialisation: '',
  yearsOfExperience: '', qualifications: '', languagesSpoken: '',
}

export const Psychologists = () => {
  const [modalOpen, setModalOpen]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [vals, setVals]             = useState(EMPTY)
  const [errs, setErrs]             = useState({})

  const { data: list, isLoading, refetch } = useApi(
    ['users', 'clinicians'],
    () => api.get('/users/clinicians')
  )

  const set = (field) => (e) => {
    setVals(v => ({ ...v, [field]: e.target.value }))
    if (errs[field]) setErrs(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!vals.firstName.trim()) e.firstName = 'First name required'
    if (!vals.lastName.trim())  e.lastName  = 'Last name required'
    if (!vals.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals.email))
      e.email = 'Valid email required'
    if (!vals.password || vals.password.length < 10)
      e.password = 'Password must be at least 10 characters'
    else if (!/[A-Z]/.test(vals.password) || !/[0-9]/.test(vals.password) || !/[!@#$%^&*]/.test(vals.password))
      e.password = 'Needs uppercase, number, and special char (!@#$%^&*)'
    return e
  }

  const handleSave = async () => {
    const errors = validate()
    if (Object.keys(errors).length > 0) { setErrs(errors); return }

    setSaving(true)
    try {
      await api.post('/users/clinicians', {
        ...vals,
        yearsOfExperience: vals.yearsOfExperience ? Number(vals.yearsOfExperience) : 0,
        qualifications: vals.qualifications ? vals.qualifications.split(',').map(s => s.trim()) : [],
        languagesSpoken: vals.languagesSpoken ? vals.languagesSpoken.split(',').map(s => s.trim()) : [],
      })
      toast.success('Psychologist account created')
      setModalOpen(false)
      setVals(EMPTY)
      refetch?.()
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to create account')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id, name) => {
    if (!window.confirm(`Deactivate ${name}? They will lose access.`)) return
    try {
      await api.patch(`/users/${id}`, { isActive: false })
      toast.success('Account deactivated')
      refetch?.()
    } catch {
      toast.error('Failed to deactivate')
    }
  }

  if (isLoading) return <LoadingScreen />

  const clinicians = list?.data || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-app">Psychologists & Clinicians</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all clinical staff across the platform</p>
        </div>
        <Button variant="primary" onClick={() => { setErrs({}); setVals(EMPTY); setModalOpen(true) }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Psychologist
        </Button>
      </div>

      {clinicians.length === 0 && (
        <Card className="p-12 text-center">
          <Brain className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No psychologists added yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first clinical staff member above</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {clinicians.map((c) => (
          <Card key={c._id} className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(c.firstName || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-app truncate">
                  {c.firstName} {c.lastName}
                </h3>
                <p className="text-xs text-violet-600 font-medium">{ROLE_LABELS[c.role] || c.role}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{c.email}</p>
                {c.clinicianProfile?.specialisation && (
                  <p className="text-xs text-gray-400 mt-1">
                    {c.clinicianProfile.specialisation}
                  </p>
                )}
                {c.clinicianProfile?.rciRegistrationNumber && (
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-600">RCI: {c.clinicianProfile.rciRegistrationNumber}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="danger" size="sm" onClick={() => handleDeactivate(c._id, `${c.firstName} ${c.lastName}`)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Deactivate
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Psychologist Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Psychologist / Clinician" size="lg">
        <div className="space-y-4">
          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={vals.role}
              onChange={set('role')}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="CLINICAL_PSYCHOLOGIST">Clinical Psychologist</option>
              <option value="SENIOR_CLINICIAN">Senior Clinician</option>
            </select>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input value={vals.firstName} onChange={set('firstName')} placeholder="First name"
                className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errs.firstName ? 'border-red-400' : 'border-gray-200'}`} />
              {errs.firstName && <p className="text-xs text-red-500 mt-1">{errs.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input value={vals.lastName} onChange={set('lastName')} placeholder="Last name"
                className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errs.lastName ? 'border-red-400' : 'border-gray-200'}`} />
              {errs.lastName && <p className="text-xs text-red-500 mt-1">{errs.lastName}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={vals.email} onChange={set('email')} placeholder="psych@hospital.com"
              className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errs.email ? 'border-red-400' : 'border-gray-200'}`} />
            {errs.email && <p className="text-xs text-red-500 mt-1">{errs.email}</p>}
          </div>

          {/* Tenant ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
            <input value={vals.tenantId} onChange={set('tenantId')} placeholder="Leave blank for global / Cittaa tenant"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          {/* Temp password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
            <input type="text" value={vals.password} onChange={set('password')} placeholder="Min 10 chars, uppercase, number, symbol"
              className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono ${errs.password ? 'border-red-400' : 'border-gray-200'}`} />
            {errs.password && <p className="text-xs text-red-500 mt-1">{errs.password}</p>}
            <p className="text-xs text-gray-400 mt-1">The psychologist can change this on first login.</p>
          </div>

          {/* Professional details */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Professional Details (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">RCI Registration No.</label>
                <input value={vals.rciRegistrationNumber} onChange={set('rciRegistrationNumber')}
                  placeholder="RCI-XXXXX"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Years of Experience</label>
                <input type="number" min="0" max="50" value={vals.yearsOfExperience} onChange={set('yearsOfExperience')}
                  placeholder="e.g. 5"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Specialisation</label>
              <select value={vals.specialisation} onChange={set('specialisation')}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Select specialisation…</option>
                {SPECIALISATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Qualifications (comma-separated)</label>
              <input value={vals.qualifications} onChange={set('qualifications')}
                placeholder="e.g. M.Phil. Clinical Psychology, PhD"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Languages Spoken (comma-separated)</label>
              <input value={vals.languagesSpoken} onChange={set('languagesSpoken')}
                placeholder="e.g. English, Hindi, Tamil"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={handleSave} loading={saving}>
              Create Account
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Psychologists
