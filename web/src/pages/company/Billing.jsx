import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen, Modal } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

const PLANS = [
  { value: 'starter',    label: 'Starter',       price: 'â¹29,000/mo',  desc: 'Up to 100 employees Â· Core wellness tools' },
  { value: 'pro',        label: 'Professional',  price: 'â¹79,000/mo',  desc: 'Up to 500 employees Â· Advanced analytics + EAP' },
  { value: 'enterprise', label: 'Enterprise',    price: 'Custom',      desc: 'Unlimited employees Â· Dedicated support + SLA' },
]

export const Billing = () => {
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [changing, setChanging] = useState(false)

  const { data: billing, isLoading } = useApi(['billing'], () => api.get('/company/billing').then(r => r.data))

  const handleChangePlan = async () => {
    if (!selectedPlan) {
      toast.error('Please select a plan')
      return
    }
    setChanging(true)
    try {
      await api.post('/company/billing/change-plan', { tier: selectedPlan })
      toast.success('Plan change request submitted â our team will be in touch shortly')
      setChangePlanOpen(false)
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to submit plan change')
    } finally {
      setChanging(false)
    }
  }

  const handleUpdatePayment = () => {
    toast('To update your payment method, please contact support@cittaa.in', { icon: 'â¹ï¸', duration: 5000 })
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Billing & Subscription</h1>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-6">Current Plan</h2>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-600">Plan Type</p>
            <p className="text-2xl font-bold text-cittaa-700">{billing?.planName || 'â'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monthly Cost</p>
            <p className="text-2xl font-bold text-cittaa-700">{billing?.monthlyCost || 'â'}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setChangePlanOpen(true)}>Change Plan</Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-4">Payment Method</h2>
        <p className="text-gray-600 mb-4">
          {billing?.paymentMethod?.last4
            ? `â¢â¢â¢â¢ â¢â¢â¢â¢ â¢â¢â¢â¢ ${billing.paymentMethod.last4}`
            : 'No payment method on file'}
        </p>
        <Button variant="secondary" onClick={handleUpdatePayment}>Update Payment Method</Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-4">Billing History</h2>
        {billing?.invoices?.length > 0 ? (
          <div className="space-y-2">
            {billing.invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-3 border-b">
                <span className="text-app">{new Date(invoice.date).toLocaleDateString()}</span>
                <span className="text-app font-medium">{invoice.amount}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No invoices yet</p>
        )}
      </Card>

      {/* Change Plan Modal */}
      <Modal isOpen={changePlanOpen} onClose={() => setChangePlanOpen(false)} title="Change Plan" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Select a new plan. Our team will contact you to process the change.</p>
          <div className="space-y-3">
            {PLANS.map(plan => (
              <label
                key={plan.value}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPlan === plan.value ? 'border-cittaa-700 bg-cittaa-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={plan.value}
                  checked={selectedPlan === plan.value}
                  onChange={() => setSelectedPlan(plan.value)}
                  className="accent-cittaa-700"
                />
                <div className="flex-1">
                  <div className="font-semibold text-app">{plan.label}</div>
                  <div className="text-sm text-gray-500">{plan.desc}</div>
                </div>
                <div className="font-bold text-cittaa-700 whitespace-nowrap">{plan.price}</div>
              </label>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={handleChangePlan} loading={changing}>
              Request Change
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setChangePlanOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Billing
