import { useAuth } from '../../hooks/useAuth'
import { Card, Button, Input } from '../../components/ui'
import { useForm } from 'react-hook-form'

export const MyProfile = () => {
  const { user } = useAuth()
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      department: user?.department || '',
    },
  })

  const onSubmit = (data) => {
    console.log('Update profile:', data)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-app">My Profile</h1>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-6">Personal Information</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" {...register('name')} />
          <Input label="Email" type="email" {...register('email')} disabled />
          <Input label="Phone" type="tel" {...register('phone')} />
          <Input label="Department" {...register('department')} disabled />
          <Button variant="primary" type="submit">
            Save Changes
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-4">Privacy & Security</h2>
        <div className="space-y-3">
          <Button variant="secondary" className="w-full justify-start">
            Change Password
          </Button>
          <Button variant="secondary" className="w-full justify-start">
            Two-Factor Authentication
          </Button>
          <Button variant="secondary" className="w-full justify-start">
            Manage Data & Privacy
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default MyProfile
