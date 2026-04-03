import { useState } from 'react'
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { Badge, Button, Modal } from '../ui'
import { format } from 'date-fns'

export const AlertCard = ({
  alert,
  onAcknowledge,
  onEscalate,
  onResolve,
  userRole,
}) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalAction, setModalAction] = useState(null)

  const getRiskBadge = (riskLevel) => {
    const variants = {
      critical: 'danger',
      high: 'warning',
      medium: 'warning',
      low: 'success',
    }
    return variants[riskLevel] || 'info'
  }

  const getStatusBadge = (status) => {
    const variants = {
      active: 'danger',
      acknowledged: 'warning',
      resolved: 'success',
    }
    return variants[status] || 'info'
  }

  const handleAction = (action) => {
    setModalAction(action)
    setModalOpen(true)
  }

  const confirmAction = async () => {
    switch (modalAction) {
      case 'acknowledge':
        await onAcknowledge?.(alert.id)
        break
      case 'escalate':
        await onEscalate?.(alert.id)
        break
      case 'resolve':
        await onResolve?.(alert.id)
        break
    }
    setModalOpen(false)
  }

  return (
    <>
      <div className="card-base p-4 border-l-4" style={{ borderLeftColor: alert.riskLevel === 'critical' ? '#EF4444' : '#F59E0B' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold text-app">{alert.employeeName}</p>
            <p className="text-sm text-gray-600">ID: {alert.employeeRef}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant={getRiskBadge(alert.riskLevel)} size="sm">
              {alert.riskLevel.charAt(0).toUpperCase() + alert.riskLevel.slice(1)} Risk
            </Badge>
            <Badge variant={getStatusBadge(alert.status)} size="sm">
              {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Alert Details */}
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
          <p className="text-xs text-gray-500">
            {format(new Date(alert.createdAt), 'MMM dd, yyyy HH:mm')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {alert.status === 'active' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleAction('acknowledge')}
              >
                Acknowledge
              </Button>
              {(userRole === 'SENIOR_CLINICIAN' ||
                userRole === 'CLINICAL_PSYCHOLOGIST') && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleAction('escalate')}
                >
                  Escalate
                </Button>
              )}
            </>
          )}

          {(alert.status === 'active' || alert.status === 'acknowledged') && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleAction('resolve')}
            >
              Resolve
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirm Action"
      >
        <p className="text-gray-700 mb-6">
          {modalAction === 'acknowledge' &&
            `Mark alert for ${alert.employeeName} as acknowledged?`}
          {modalAction === 'escalate' &&
            `Escalate alert for ${alert.employeeName} to senior clinician?`}
          {modalAction === 'resolve' &&
            `Mark alert for ${alert.employeeName} as resolved?`}
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={() => setModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmAction}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default AlertCard
