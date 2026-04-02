import { Card } from '../../components/ui'
import { TrendingUp } from 'lucide-react'

export const ManagerDashboard = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-app">Manager Coaching</h1>
    <Card className="p-12 flex flex-col items-center justify-center text-gray-300 gap-3">
      <TrendingUp className="w-12 h-12" />
      <p className="text-sm text-gray-400">Manager coaching dashboard coming soon</p>
    </Card>
  </div>
)

export default ManagerDashboard
