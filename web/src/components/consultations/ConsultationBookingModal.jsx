import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select } from '../ui'
import { useApiMutation } from '../../hooks/useApi'
import api from '../../services/api'
import { AlertCircle, Calendar, Clock } from 'lucide-react'

const bookingSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  clinicianId: z.string().min(1, 'Clinician is required'),
  consultationType: z.string().min(1, 'Consultation type is required'),
  mode: z.enum(['online', 'offline'], { errorMap: () => ({ message: 'Mode is required' }) }),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  duration: z.string().min(1, 'Duration is required'),
  location: z.string().optional(),
  notes: z.string().optional(),
})

export const ConsultationBookingModal = ({
  isOpen,
  onClose,
  patientId = null,
  onSuccess = null,
  hasGoogleIntegration = false,
}) => {
  const [availableSlots, setAvailableSlots] = useState([])
  const [showAvailability, setShowAvailability] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      patientId: patientId || '',
      mode: 'online',
      duration: '60',
    },
  })

  const mode = watch('mode')
  const selectedDate = watch('date')
  const clinicianId = watch('clinicianId')
  const duration = watch('duration')

  const bookMutation = useApiMutation(
    (data) => api.post('/consultations', data),
    {
      successMessage: 'Consultation booked successfully',
      onSuccess: (data) => {
        onSuccess?.(data)
        onClose()
      },
    }
  )

  const checkAvailabilityMutation = useApiMutation(
    (params) =>
      api.get('/consultations/availability', {
        params,
      }),
    {
      successMessage: false,
      onSuccess: (data) => {
        setAvailableSlots(data.slots || [])
      },
    }
  )

  const onSubmit = (data) => {
    bookMutation.mutate(data)
  }

  const handleCheckAvailability = () => {
    if (!clinicianId || !selectedDate || !duration) {
      return
    }
    checkAvailabilityMutation.mutate({
      clinicianId,
      date: selectedDate,
      duration: parseInt(duration),
    })
    setShowAvailability(true)
  }

  const consultationTypes = [
    { value: 'pre-assessment', label: 'Pre-Assessment' },
    { value: 'post-assessment', label: 'Post-Assessment' },
    { value: 'follow-up', label: 'Follow-up' },
    { value: 'crisis', label: 'Crisis' },
    { value: 'routine', label: 'Routine' },
  ]

  const durations = [
    { value: '30', label: '30 minutes' },
    { value: '45', label: '45 minutes' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Consultation" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Patient Selection */}
        <div>
          <label className="block text-sm font-medium text-app mb-2">
            Patient <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            placeholder="Search or select patient"
            className="input-base w-full"
            {...register('patientId')}
          />
          {errors.patientId && (
            <p className="text-sm text-red-600 mt-1">{errors.patientId.message}</p>
          )}
        </div>

        {/* Clinician */}
        <Select
          label="Clinician *"
          options={[
            { value: '1', label: 'Dr. Smith' },
            { value: '2', label: 'Dr. Johnson' },
          ]}
          {...register('clinicianId')}
          error={errors.clinicianId?.message}
        />

        {/* Consultation Type */}
        <Select
          label="Consultation Type *"
          options={consultationTypes}
          {...register('consultationType')}
          error={errors.consultationType?.message}
        />

        {/* Mode Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-app">
            Consultation Mode <span className="text-red-600">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="online"
                {...register('mode')}
              />
              <span className="text-sm text-app">Online - Google Meet</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="offline"
                {...register('mode')}
              />
              <span className="text-sm text-app">Offline - In Person</span>
            </label>
          </div>
          {errors.mode && (
            <p className="text-sm text-red-600">{errors.mode.message}</p>
          )}
        </div>

        {/* Google Meet Info */}
        {mode === 'online' && hasGoogleIntegration && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              A Google Meet link will be automatically created and sent to both participants.
            </p>
          </div>
        )}

        {/* Date */}
        <Input
          label="Date *"
          type="date"
          {...register('date')}
          error={errors.date?.message}
          min={new Date().toISOString().split('T')[0]}
        />

        {/* Duration */}
        <Select
          label="Duration *"
          options={durations}
          {...register('duration')}
          error={errors.duration?.message}
        />

        {/* Check Availability */}
        <Button
          type="button"
          variant="secondary"
          onClick={handleCheckAvailability}
          loading={checkAvailabilityMutation.isPending}
          className="w-full"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Check Availability
        </Button>

        {/* Available Slots */}
        {showAvailability && availableSlots.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-app">
              Available Time Slots
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {availableSlots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setValue('time', slot.time)}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-cittaa-50 hover:border-cittaa-700 transition text-sm"
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Time */}
        <Input
          label="Time *"
          type="time"
          {...register('time')}
          error={errors.time?.message}
        />

        {/* Location (if offline) */}
        {mode === 'offline' && (
          <Input
            label="Location"
            placeholder="Room number or address"
            {...register('location')}
            error={errors.location?.message}
          />
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-app mb-2">
            Additional Notes
          </label>
          <textarea
            placeholder="Any special notes or requirements..."
            rows={3}
            className="input-base w-full resize-none"
            {...register('notes')}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={bookMutation.isPending}
          >
            Book Consultation
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ConsultationBookingModal
