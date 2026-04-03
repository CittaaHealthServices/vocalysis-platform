import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import ConsultationCard from '../../components/consultations/ConsultationCard'
import api from '../../services/api'

export const MyConsultations = () => {
  const { data: consultations, isLoading } = useApi(['my', 'consultations'], () => api.get('/my/consultations'))

  if (isLoading) return <LoadingScreen />

  const upcoming = consultations?.data?.filter((c) => c.status === 'scheduled') || []
  const past = consultations?.data?.filter((c) => c.status !== 'scheduled') || []

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-app">My Consultations</h1>

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
          <Button variant="primary">Request Consultation</Button>
        </Card>
      )}
    </div>
  )
}

export default MyConsultations
