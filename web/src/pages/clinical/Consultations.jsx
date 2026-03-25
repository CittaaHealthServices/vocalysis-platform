import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Button, Badge, LoadingScreen } from '../../components/ui'
import ConsultationBookingModal from '../../components/consultations/ConsultationBookingModal'
import ConsultationCard from '../../components/consultations/ConsultationCard'
import api from '../../services/api'

export const Consultations = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState('calendar')

  const { data: consultations, isLoading } = useApi(
    ['consultations'],
    () => api.get('/consultations')
  )

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">Consultations</h1>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          + Book Consultation
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-4 py-2 rounded-lg ${viewMode === 'calendar' ? 'bg-cittaa-700 text-white' : 'bg-gray-100'}`}
        >
          Calendar View
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-lg ${viewMode === 'list' ? 'bg-cittaa-700 text-white' : 'bg-gray-100'}`}
        >
          List View
        </button>
      </div>

      {viewMode === 'list' && (
        <div className="grid grid-cols-1 gap-4">
          {consultations?.data?.map((consultation) => (
            <ConsultationCard key={consultation.id} consultation={consultation} />
          ))}
        </div>
      )}

      <ConsultationBookingModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

export default Consultations
