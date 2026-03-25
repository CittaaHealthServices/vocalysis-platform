import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input } from '../../components/ui'
import api from '../../services/api'
import toast from 'react-hot-toast'

const schema = z.object({
  email: z.string().email('Invalid email address'),
})

export const ForgotPassword = () => {
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
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
      await api.post('/auth/forgot-password', {
        email: data.email,
      })
      setSubmitted(true)
      toast.success('Password reset link sent to your email')
    } catch (error) {
      toast.error(error.error?.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cittaa-700 to-cittaa-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-2xl font-bold text-app mb-2">Reset Password</h2>
        <p className="text-gray-600 mb-8">
          {submitted
            ? 'Check your email for a password reset link'
            : 'Enter your email address and we'll send you a link to reset your password'}
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              error={errors.email?.message}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={isLoading}
            >
              Send Reset Link
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
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                If an account exists with that email, you'll receive a password reset link shortly.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
