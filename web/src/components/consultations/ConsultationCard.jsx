import { format, differenceInHours } from 'date-fns'
import { Badge, Button } from '../ui'
import { Video, MapPin, ExternalLink } from 'lucide-react'

export const ConsultationCard = ({
  consultation,
  onReschedule,
  onCancel,
  onComplete,
  onJoin,
}) => {
  const startTime = new Date(consultation.startTime)
  const hoursUntil = differenceInHours(startTime, new Date())
  const isWithin2Hours = hoursUntil > 0 && hoursUntil <= 2

  const getModeIcon = () => {
    return consultation.mode === 'online' ? (
      <Video className="w-4 h-4" />
    ) : (
      <MapPin className="w-4 h-4" />
    )
  }

  const getModeVariant = () => {
    return consultation.mode === 'online' ? 'online' : 'offline'
  }

  return (
    <div className="card-base p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-app">{consultation.patientName}</h3>
          <p className="text-sm text-gray-600">with {consultation.clinicianName}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={getModeVariant()} size="sm" className="flex items-center gap-1">
            {getModeIcon()}
            {consultation.mode === 'online' ? 'Online' : 'In-Person'}
          </Badge>
          <Badge variant={consultation.status} size="sm">
            {consultation.status.charAt(0).toUpperCase() +
              consultation.status.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-700">
          <span className="font-medium">{format(startTime, 'MMM dd, yyyy')}</span>
          {' at '}
          <span className="font-medium">{format(startTime, 'HH:mm')}</span>
        </p>
        <p className="text-sm text-gray-600">
          Duration: {consultation.duration} minutes
        </p>
        {consultation.mode === 'offline' && consultation.location && (
          <p className="text-sm text-gray-600">
            Location: {consultation.location}
          </p>
        )}
      </div>

      {/* Countdown Timer */}
      {isWithin2Hours && consultation.status === 'scheduled' && (
        <div className="mb-4 p-2 bg-orange-50 border border-orange-200 rounded">
          <p className="text-xs text-orange-700 font-medium">
            ⏰ Starting in {hoursUntil > 0 ? hoursUntil + ' hour(s)' : 'Less than 1 hour'}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {consultation.status === 'scheduled' && isWithin2Hours && consultation.mode === 'online' && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => onJoin?.(consultation.meetingLink)}
            className="flex items-center gap-1"
          >
            <Video className="w-4 h-4" />
            Join Meeting
          </Button>
        )}

        {consultation.status === 'scheduled' && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onReschedule?.(consultation.id)}
            >
              Reschedule
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onCancel?.(consultation.id)}
            >
              Cancel
            </Button>
          </>
        )}

        {consultation.status === 'completed' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onComplete?.(consultation.id)}
          >
            Add Notes
          </Button>
        )}
      </div>
    </div>
  )
}

export default ConsultationCard
