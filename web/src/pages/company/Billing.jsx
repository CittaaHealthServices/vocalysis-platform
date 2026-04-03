import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import api from '../../services/api'

export const Billing = () => {
  const { data: billing, isLoading } = useApi(['billing'], () => api.get('/company/billing'))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Billing & Subscription</h1>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-6">Current Plan</h2>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-600">Plan Type</p>
            <p className="text-2xl font-bold text-cittaa-700">{billing?.planName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monthly Cost</p>
            <p className="text-2xl font-bold text-cittaa-700">${billing?.monthlyCost}</p>
          </div>
        </div>
        <Button variant="secondary">Change Plan</Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-4">Payment Method</h2>
        <p className="text-gray-600 mb-4">
          {billing?.paymentMethod?.last4
            ? `•••• •••• •••• ${billing.paymentMethod.last4}`
            : 'No payment method on file'}
        </p>
        <Button variant="secondary">Update Payment Method</Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-4">Billing History</h2>
        <div className="space-y-2">
          {billing?.invoices?.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between p-3 border-b">
              <span className="text-app">{new Date(invoice.date).toLocaleDateString()}</span>
              <span className="text-app font-medium">${invoice.amount}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default Billing
