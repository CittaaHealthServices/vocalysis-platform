import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Card, Button, Input } from '../../components/ui'
import { useForm } from 'react-hook-form'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const MyProfile = () => {
  const { user } = useAuth()
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      firstName:  user?.firstName  || '',
      lastName:   user?.lastName   || '',
      email:      user?.email      || '',
      phone:      user?.phone      || '',
      department: user?.departmentId || '',
    },
  })

  // Re-populate form once auth context user data is available
  // (useForm captures defaultValues on mount before async auth resolves)
  useEffect(() => {
    if (user) {
      reset({
        firstName:  user.firstName  || '',
        lastName:   user.lastName   || '',
        email:      user.email      || '',
        phone:      user.phone      || '',
        department: user.departmentId || '',
      })
    }
  }, [user, reset])

  const onSubmit = async (data) => {
    try {
      await api.patch('/users/me', { firstName: data.firstName, lastName: data.lastName, phone: data.phone })
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to update profile')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-app">My Profile</h1>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-app mb-6">Personal Information</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="First Name" {...register('firstName')} />
          <Input label="Last Name"  {...register('lastName')}  />
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
