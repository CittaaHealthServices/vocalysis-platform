import { Card } from '../../components/ui'
import { HeartPulse } from 'lucide-react'

export const EAPDashboard = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-app">EAP Provider Dashboard</h1>
    <Card className="p-12 flex flex-col items-center justify-center text-gray-300 gap-3">
      <HeartPulse className="w-12 h-12" />
      <p className="text-sm text-gray-400">EAP provider dashboard coming soon</p>
    </Card>
  </div>
)

export default EAPDashboard
