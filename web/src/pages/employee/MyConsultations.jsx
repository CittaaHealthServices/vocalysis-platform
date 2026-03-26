import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Button, Input, LoadingScreen, Modal } from '../../components/ui'
import ConsultationCard from '../../components/consultations/ConsultationCard'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const MyConsultations = () => {
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [reason, setReason] = useState('')

  const { data: consultations, isLoading, refetch } = useApi(['my', 'consultations'], () => api.get('/my/consultations'))

  const handleRequest = async () => {
    setRequesting(true)
    try {
      await api.post('/consultations/request', { reason })
      toast.success('Consultation request submitted — you will be contacted shortly')
      setRequestModalOpen(false)
      setReason('')
      refetch?.()
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to submit request')
    } finally {
      setRequesting(false)
    }
  }

  if (isLoading) return <LoadingScreen />

  const upcoming = consultations?.data?.filter((c) => c.status === 'scheduled') || []
  const past = consultations?.data?.filter((c) => c.status !== 'scheduled') || []

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">My Consultations</h1>
        <Button variant="primary" onClick={() => setRequestModalOpen(true)}>
          Request Consultation
        </Button>
      </div>

      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-app mb-4">Upcoming Consultations</h2>
          <div className="grid grid-cols-1 gap-4">
            {upcoming.map((consultation) => (
              <ConsultationCard key={consultation.id} consultation={consultation} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-app mb-4">Past Consultations</h2>
          <div className="grid grid-cols-1 gap-4">
            {past.map((consultation) => (
              <ConsultationCard key={consultation.id} consultation={consultation} />
            ))}
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-gray-600 mb-6">No consultations scheduled yet</p>
          <Button variant="primary" onClick={() => setRequestModalOpen(true)}>Request Consultation</Button>
        </Card>
      )}

      <Modal isOpen={requestModalOpen} onClose={() => setRequestModalOpen(false)} title="Request a Consultation" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tell us a bit about what you'd like support with. A clinician will reach out to schedule a session.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What's on your mind? (optional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-cittaa-700 transition"
              rows={4}
              placeholder="e.g. I've been feeling stressed at work lately and would like to talk to someone..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={handleRequest} loading={requesting}>
              Submit Request
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setRequestModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default MyConsultations
