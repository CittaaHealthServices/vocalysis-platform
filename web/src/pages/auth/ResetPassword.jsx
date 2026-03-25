import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters').regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export const ResetPassword = () => {
  const navigate = useNavigate()
  const { token } = useParams()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    try {
      await api.post('/auth/reset-password', {
        token,
        password: data.password,
      })
      toast.success('Password reset successfully')
      navigate('/login')
    } catch (error) {
      toast.error(error.error?.message || 'Reset failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cittaa-700 to-cittaa-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-2xl font-bold text-app mb-2">Create New Password</h2>
        <p className="text-gray-600 mb-8">Enter your new password below</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="New Password"
            type="password"
            placeholder="••••••••"
            {...register('password')}
            error={errors.password?.message}
            helperText="Min 8 chars, 1 uppercase, 1 number, 1 special char"
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={isLoading}
          >
            Reset Password
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            Back to Login
          </Button>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
