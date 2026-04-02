import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen, Modal, Badge } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Mail, Phone, Building2, Calendar, User,
  Activity, ShieldCheck, AlertCircle, Edit2, ToggleLeft,
  ToggleRight, Clock, TrendingUp
} from 'lucide-react'

const ROLE_LABEL = {
  EMPLOYEE:              'Employee',
  HR_ADMIN:              'HR Admin',
  CLINICAL_PSYCHOLOGIST: 'Psychologist',
  SENIOR_CLINICIAN:      'Senior Clinician',
  COMPANY_ADMIN:         'Company Admin',
  CLINICIAN:             'Clinician',
}

const RISK_COLOR = {
  LOW:      { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Low Risk' },
  MODERATE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Moderate Risk' },
  HIGH:     { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High Risk' },
  CRITICAL: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Critical' },
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="mt-0.5 text-gray-400">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export const EmployeeProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [confirmModal, setConfirmModal] = useState(false)
  const [toggling, setToggling]         = useState(false)

  const { data: empData, isLoading, isError, refetch } = useApi(
    ['employee', id],
    () => api.get(`/employees/${id}`)
  )

  const emp = empData?.data || empData || null

  const { data: sessData } = useApi(
    ['employee-sessions', id],
    () => api.get(`/employees/${id}/sessions`, { params: { limit: 10 } }),
    { enabled: !!id }
  )

  const sessions = sessData?.data?.sessions || sessData?.sessions || []

  const handleToggleStatus = async () => {
    setToggling(true)
    try {
      await api.patch(`/employees/${id}`, { isActive: !emp.isActive })
      toast.success(`Employee ${emp.isActive ? 'deactivated' : 'activated'} successfully`)
      setConfirmModal(false)
      refetch?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setToggling(false)
    }
  }

  if (isLoading) return <LoadingScreen />

  if (isError || !emp) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">Employee not found</p>
        <Button variant="secondary" onClick={() => navigate('/hr/employees')}>
          ← Back to Employees
        </Button>
      </div>
    )
  }

  const fullName   = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email
  const initials   = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || '?'
  const riskStyle  = RISK_COLOR[emp.riskLevel] || RISK_COLOR.LOW
  const joinedDate = emp.joiningDate
    ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const lastAssess = emp.lastAssessmentDate
    ? new Date(emp.lastAssessmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Never'

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Back */}
      <button
        onClick={() => navigate('/hr/employees')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Employees
      </button>

      {/* Header card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          {emp.profilePicture ? (
            <img
              src={emp.profilePicture}
              alt={fullName}
              className="w-20 h-20 rounded-full object-cover border-2 border-violet-100 flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center text-2xl font-bold text-violet-600 flex-shrink-0">
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                emp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {emp.isActive ? 'Active' : 'Inactive'}
              </span>
              {emp.riskLevel && emp.riskLevel !== 'LOW' && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskStyle.bg} ${riskStyle.text}`}>
                  {riskStyle.label}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{ROLE_LABEL[emp.role] || emp.role} · {emp.department || 'No Department'}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant={emp.isActive ? 'danger' : 'primary'}
              size="sm"
              onClick={() => setConfirmModal(true)}
            >
              {emp.isActive
                ? <><ToggleLeft className="w-4 h-4 mr-1 inline" /> Deactivate</>
                : <><ToggleRight className="w-4 h-4 mr-1 inline" /> Activate</>
              }
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Details */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Contact Info</h2>
            <div className="divide-y divide-gray-50">
              <InfoRow icon={Mail}     label="Email"       value={emp.email} />
              <InfoRow icon={Phone}    label="Phone"       value={emp.phone} />
              <InfoRow icon={Building2} label="Department" value={emp.department} />
              <InfoRow icon={Calendar} label="Joined"      value={joinedDate} />
              <InfoRow icon={User}     label="Employee ID" value={emp.employeeId || emp._id?.slice(-8)?.toUpperCase()} />
            </div>
          </Card>

          {/* Wellness Summary */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Wellness Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Wellness Score</span>
                <span className={`text-lg font-bold ${
                  !emp.wellnessScore ? 'text-gray-400'
                  : emp.wellnessScore >= 70 ? 'text-green-600'
                  : emp.wellnessScore >= 50 ? 'text-yellow-600'
                  : 'text-red-600'
                }`}>
                  {emp.wellnessScore ? `${emp.wellnessScore}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Assessments</span>
                <span className="text-sm font-semibold text-gray-700">{emp.assessmentCount || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Last Assessment</span>
                <span className="text-sm text-gray-600">{lastAssess}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Risk Level</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskStyle.bg} ${riskStyle.text}`}>
                  {riskStyle.label}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Assessment History */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Assessment History</h2>
              <span className="text-xs text-gray-400">Last 10 sessions</span>
            </div>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-3">
                <Activity className="w-10 h-10" />
                <p className="text-sm">No assessments yet</p>
                <p className="text-xs text-gray-400">This employee hasn't completed any check-ins</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session, i) => {
                  const score = session.wellnessScore ?? session.scores?.overall ?? null
                  const risk  = session.riskLevel || 'LOW'
                  const rs    = RISK_COLOR[risk] || RISK_COLOR.LOW
                  const date  = session.completedAt || session.createdAt
                  return (
                    <div key={session._id || i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex-shrink-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${rs.bg}`}>
                          <TrendingUp className={`w-4 h-4 ${rs.text}`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {session.assessmentType || 'Wellness Check-In'}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {score != null && (
                          <span className={`text-sm font-bold ${
                            score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'
                          }`}>{score}%</span>
                        )}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rs.bg} ${rs.text}`}>
                          {rs.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Confirm deactivate/activate modal */}
      <Modal
        isOpen={confirmModal}
        onClose={() => setConfirmModal(false)}
        title={emp.isActive ? 'Deactivate Employee?' : 'Activate Employee?'}
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-5">
          {emp.isActive
            ? `${fullName} will no longer be able to log in or complete assessments.`
            : `${fullName} will regain access to the platform.`
          }
        </p>
        <div className="flex gap-3">
          <Button
            variant={emp.isActive ? 'danger' : 'primary'}
            className="flex-1"
            onClick={handleToggleStatus}
            loading={toggling}
          >
            {toggling ? 'Updating…' : (emp.isActive ? 'Deactivate' : 'Activate')}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmModal(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default EmployeeProfile
