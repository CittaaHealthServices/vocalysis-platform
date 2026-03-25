import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { Calendar, Users } from 'lucide-react'
import api from '../../services/api'

export const Scheduling = () => {
  const { data: scheduling, isLoading } = useApi(['scheduling'], () => api.get('/scheduling'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Assessment Scheduling</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-cittaa-700" />
            <h3 className="text-lg font-semibold text-app">Upcoming Assessments</h3>
          </div>
          <p className="text-gray-600">View and manage scheduled assessments</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-cittaa-700" />
            <h3 className="text-lg font-semibold text-app">Pending Invitations</h3>
          </div>
          <p className="text-gray-600">Track employee invitation status</p>
        </Card>
      </div>
    </div>
  )
}

export default Scheduling
