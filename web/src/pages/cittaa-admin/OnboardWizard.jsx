import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, Button, Input, Select, LoadingScreen } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

const onboardSchema = z.object({
  companyName: z.string().min(3, 'Company name is required'),
  industry: z.string().min(1, 'Industry is required'),
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  employeeCount: z.string().min(1, 'Employee count is required'),
  adminName: z.string().min(1, 'Admin name is required'),
  adminEmail: z.string().email('Valid email is required'),
  tier: z.string().min(1, 'Subscription tier is required'),
})

const STEPS = ['Company Info', 'Location', 'Admin Details', 'Plan Selection', 'Review']

export const OnboardWizard = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(onboardSchema),
    mode: 'onChange',
  })

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      await api.post('/tenants', data)
      toast.success('Company onboarded successfully')
      navigate('/cittaa-admin/tenants')
    } catch (error) {
      toast.error('Onboarding failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = () => {
    handleSubmit(onSubmit)()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Progress */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                idx <= currentStep
                  ? 'bg-cittaa-700 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {idx + 1}
            </div>
            <p className="text-sm ml-2 text-app font-medium">{step}</p>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  idx < currentStep ? 'bg-cittaa-700' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="p-8 mb-8">
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-app mb-6">Company Information</h2>
              <Input
                label="Company Name"
                {...register('companyName')}
                error={errors.companyName?.message}
              />
              <Select
                label="Industry"
                options={[
                  { value: 'tech', label: 'Technology' },
                  { value: 'finance', label: 'Finance' },
                  { value: 'healthcare', label: 'Healthcare' },
                  { value: 'other', label: 'Other' },
                ]}
                {...register('industry')}
                error={errors.industry?.message}
              />
              <Input
                label="Number of Employees"
                type="number"
                {...register('employeeCount')}
                error={errors.employeeCount?.message}
              />
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-app mb-6">Location</h2>
              <Input
                label="Country"
                {...register('country')}
                error={errors.country?.message}
              />
              <Input
                label="City"
                {...register('city')}
                error={errors.city?.message}
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-app mb-6">Administrator Details</h2>
              <Input
                label="Admin Full Name"
                {...register('adminName')}
                error={errors.adminName?.message}
              />
              <Input
                label="Admin Email"
                type="email"
                {...register('adminEmail')}
                error={errors.adminEmail?.message}
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-app mb-6">Subscription Plan</h2>
              <Select
                label="Subscription Tier"
                options={[
                  { value: 'starter', label: 'Starter - $500/mo' },
                  { value: 'pro', label: 'Pro - $1,500/mo' },
                  { value: 'enterprise', label: 'Enterprise - Custom' },
                ]}
                {...register('tier')}
                error={errors.tier?.message}
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-app mb-6">Review & Confirm</h2>
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <p><span className="font-medium">Company:</span> {watch('companyName')}</p>
                <p><span className="font-medium">Industry:</span> {watch('industry')}</p>
                <p><span className="font-medium">Location:</span> {watch('city')}, {watch('country')}</p>
                <p><span className="font-medium">Admin:</span> {watch('adminEmail')}</p>
                <p><span className="font-medium">Plan:</span> {watch('tier')}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              className="flex-1"
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              loading={isSubmitting}
            >
              Complete Onboarding
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

export default OnboardWizard
