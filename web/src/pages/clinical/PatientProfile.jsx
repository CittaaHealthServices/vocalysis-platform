import { useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, Badge, Tabs, LoadingScreen } from '../../components/ui'
import { TrendLine } from '../../components/charts/TrendLine'
import api from '../../services/api'

export const PatientProfile = () => {
  const { id } = useParams()
  const { data: patient, isLoading } = useApi(['patient', id], () => api.get(`/patients/${id}`))

  if (isLoading) return <LoadingScreen />

  const tabs = [
    { label: 'History', content: <div className="text-gray-600">Assessment history will appear here</div> },
    { label: 'Trends', content: <TrendLine data={patient?.trendData || []} /> },
    { label: 'Biomarkers', content: <div className="text-gray-600">Biomarker analysis will appear here</div> },
    { label: 'Consultations', content: <div className="text-gray-600">Consultation history will appear here</div> },
    { label: 'Notes', content: <div className="text-gray-600">Clinical notes will appear here</div> },
    { label: 'Alerts', content: <div className="text-gray-600">Patient alerts will appear here</div> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-app">{patient?.name}</h1>
          <p className="text-gray-600">Employee ID: {patient?.employeeId}</p>
        </div>
        <Badge variant={patient?.riskLevel || 'success'} size="lg">
          {patient?.riskLevel?.toUpperCase()}
        </Badge>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Department</p>
            <p className="font-semibold text-app">{patient?.department}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tenure</p>
            <p className="font-semibold text-app">{patient?.tenure} years</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Last Assessment</p>
            <p className="font-semibold text-app">{patient?.lastAssessment}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-semibold text-app">{patient?.status}</p>
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} />
    </div>
  )
}

export default PatientProfile
