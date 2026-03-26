import { useForm } from 'react-hook-form'
import { useAuth } from '../../hooks/useAuth'
import { Card, Button, Input, Checkbox } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const CompanySettings = () => {
  const { user } = useAuth()
  const { register, handleSubmit } = useForm({
    defaultValues: {
      companyName: user?.company?.name || '',
      googleIntegration: true,
      emailNotifications: true,
      dataRetention: '90',
    },
  })

  const onSubmit = async (data) => {
    try {
      await api.patch('/company/settings', {
        googleIntegration: data.googleIntegration,
        emailNotifications: data.emailNotifications,
        dataRetentionDays: Number(data.dataRetention),
      })
      toast.success('Settings saved successfully')
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to save settings')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-app">Company Settings</h1>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-6">General Settings</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Company Name" {...register('companyName')} disabled />

          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-3">
              <Checkbox {...register('googleIntegration')} />
              <span className="text-app">Enable Google Meet Integration</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox {...register('emailNotifications')} />
              <span className="text-app">Email Notifications</span>
            </label>
          </div>

          <Input
            label="Data Retention (days)"
            type="number"
            min={30}
            max={365}
            {...register('dataRetention')}
          />

          <Button variant="primary" type="submit">
            Save Settings
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default CompanySettings
