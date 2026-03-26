import { useState } from 'react'
import { format, differenceInHours, differenceInMinutes } from 'date-fns'
import { Button } from '../ui'
import { Video, MapPin, Copy, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const ConsultationCard = ({
  consultation,
  onReschedule,
  onCancel,
  onComplete,
  onJoin,
}) => {
  const [meetLink, setMeetLink] = useState(
    consultation.googleMeet?.meetLink || consultation.googleMeet?.joinUrl || consultation.meetLink || null
  )
  const [loadingMeet, setLoadingMeet] = useState(false)
  const [copied, setCopied] = useState(false)

  const startTime    = new Date(consultation.scheduledAt || consultation.startTime)
  const minutesUntil = differenceInMinutes(startTime, new Date())
  const hoursUntil   = differenceInHours(startTime, new Date())
  const isNow        = minutesUntil <= 15 && minutesUntil >= -120

  // Create Meet room or open existing one
  const handleCreateOrJoinMeet = async () => {
    if (meetLink) {
      window.open(meetLink, '_blank', 'noopener,noreferrer')
      onJoin?.(meetLink)
      return
    }
    setLoadingMeet(true)
    try {
      const id = consultation._id || consultation.id || consultation.consultationId
      const res = await api.post(`/consultations/${id}/meet-link`)
      const link = res.meetLink || res.data?.meetLink
      setMeetLink(link)
      toast.success('Google Meet room ready!')
      window.open(link, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Could not create Meet room')
    } finally {
      setLoadingMeet(false)
    }
  }

  const handleCopyLink = async () => {
    if (!meetLink) return
    await navigator.clipboard.writeText(meetLink)
    setCopied(true)
    toast.success('Meet link copied!')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">
            {consultation.patientName || consultation.employeeName || 'Consultation'}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {consultation.clinicianName
              ? `with ${consultation.clinicianName}`
              : consultation.consultationType?.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
            ${consultation.status === 'scheduled'   ? 'bg-blue-100 text-blue-700'    :
              consultation.status === 'completed'   ? 'bg-green-100 text-green-700'  :
              consultation.status === 'in_progress' ? 'bg-violet-100 text-violet-700':
              consultation.status === 'cancelled'   ? 'bg-red-100 text-red-700'      :
                                                      'bg-gray-100 text-gray-600'}`}>
            {consultation.status?.replace(/_/g, ' ')}
          </span>
          {consultation.mode === 'online' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
              <Video className="w-3 h-3" /> Online
            </span>
          )}
          {consultation.mode === 'offline' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              <MapPin className="w-3 h-3" /> In-Person
            </span>
          )}
        </div>
      </div>

      {/* Time & details */}
      <div className="space-y-1.5 mb-4">
        <p className="text-sm text-gray-700">
          <span className="font-medium">{format(startTime, 'MMM dd, yyyy')}</span>
          {' · '}
          <span className="font-medium">{format(startTime, 'hh:mm a')}</span>
        </p>
        <p className="text-sm text-gray-500">
          Duration: {consultation.durationMinutes || consultation.duration || 60} min
        </p>
        {consultation.mode === 'offline' && consultation.location && (
          <p className="text-sm text-gray-500">📍 {consultation.location}</p>
        )}
      </div>

      {/* "Starting soon" banner */}
      {isNow && consultation.status === 'scheduled' && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse flex-shrink-0" />
          <p className="text-xs font-semibold text-violet-700">
            {minutesUntil > 0
              ? `Starting in ${minutesUntil < 60 ? `${minutesUntil} min` : `${hoursUntil}h`}`
              : 'Session in progress'}
          </p>
        </div>
      )}

      {/* ── Google Meet section ── */}
      {consultation.mode === 'online' && (
        <div className="mb-4 p-3.5 bg-gradient-to-r from-blue-50 to-sky-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            {/* Google "G" SVG */}
            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
              <path d="M22.5 12.23c0-.64-.06-1.25-.16-1.84H12v3.48h5.9a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-7.73z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09a6.94 6.94 0 0 1 0-4.18V7.07H2.18a11.09 11.09 0 0 0 0 9.86l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-xs font-bold text-blue-800">Google Meet</span>
          </div>

          {meetLink ? (
            <div className="space-y-2">
              {/* Link preview */}
              <div className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-1.5">
                <span className="text-xs text-gray-500 truncate flex-1 font-mono">{meetLink}</span>
                <button
                  onClick={handleCopyLink}
                  className="flex-shrink-0 text-gray-400 hover:text-blue-600 transition"
                  title="Copy link"
                >
                  {copied
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              {/* Join button */}
              <button
                onClick={handleCreateOrJoinMeet}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #1a73e8, #1558b0)' }}
              >
                <Video className="w-4 h-4" />
                Join via Google Meet
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleCreateOrJoinMeet}
              disabled={loadingMeet}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600
                transition-all disabled:opacity-60 active:scale-[0.98]"
            >
              {loadingMeet ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating Meet room…</>
              ) : (
                <><Video className="w-4 h-4" /> Create & Join Google Meet</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Secondary actions */}
      <div className="flex gap-2 flex-wrap">
        {consultation.status === 'scheduled' && (
          <>
            {onReschedule && (
              <Button size="sm" variant="secondary" onClick={() => onReschedule(consultation._id || consultation.id)}>
                Reschedule
              </Button>
            )}
            {onCancel && (
              <Button size="sm" variant="danger" onClick={() => onCancel(consultation._id || consultation.id)}>
                Cancel
              </Button>
            )}
          </>
        )}
        {consultation.status === 'completed' && onComplete && (
          <Button size="sm" variant="secondary" onClick={() => onComplete(consultation._id || consultation.id)}>
            View Notes
          </Button>
        )}
      </div>
    </div>
  )
}

export default ConsultationCard
