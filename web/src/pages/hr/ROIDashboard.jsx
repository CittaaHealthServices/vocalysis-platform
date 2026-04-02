import { Card } from '../../components/ui'
import { BarChart2 } from 'lucide-react'

export const ROIDashboard = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-app">ROI Dashboard</h1>
    <Card className="p-12 flex flex-col items-center justify-center text-gray-300 gap-3">
      <BarChart2 className="w-12 h-12" />
      <p className="text-sm text-gray-400">ROI analytics dashboard coming soon</p>
    </Card>
  </div>
)

export default ROIDashboard
