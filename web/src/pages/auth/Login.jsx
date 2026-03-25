import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Button, Input, Modal } from '../../components/ui'
import toast from 'react-hot-toast'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const totpSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d+$/, 'TOTP code must be numeric'),
})

export const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  })

  const {
    register: registerMfa,
    handleSubmit: handleSubmitMfa,
    formState: { errors: errorsMfa },
    reset: resetMfa,
  } = useForm({
    resolver: zodResolver(totpSchema),
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    setEmail(data.email)
    setPassword(data.password)

    const result = await login(data.email, data.password)

    if (result.requiresMfa) {
      setMfaRequired(true)
    } else if (result.success) {
      navigate('/my')
    } else {
      toast.error(result.error || 'Login failed')
    }

    setIsLoading(false)
  }

  const onSubmitMfa = async (data) => {
    setIsLoading(true)
    const result = await login(email, password, data.totpCode)

    if (result.success) {
      navigate('/my')
    } else {
      toast.error(result.error || 'Invalid TOTP code')
      resetMfa()
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cittaa-700 to-cittaa-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-cittaa-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <div>
            <h1 className="font-bold text-2xl text-app">Vocalysis</h1>
            <p className="text-xs text-gray-500">Platform 2.0</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-app mb-2">Welcome Back</h2>
        <p className="text-gray-600 mb-8">Sign in to your account to continue</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            {...register('email')}
            error={errors.email?.message}
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-10 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex justify-end">
            <a href="/forgot-password" className="text-sm text-cittaa-700 hover:underline">
              Forgot password?
            </a>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={isLoading}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Demo credentials: demo@vocalysis.com / password123
        </div>
      </div>

      {/* MFA Modal */}
      <Modal
        isOpen={mfaRequired}
        onClose={() => setMfaRequired(false)}
        title="Two-Factor Authentication"
      >
        <p className="text-gray-700 mb-4">
          Enter the 6-digit code from your authenticator app
        </p>

        <form onSubmit={handleSubmitMfa(onSubmitMfa)} className="space-y-4">
          <Input
            label="TOTP Code"
            type="text"
            placeholder="000000"
            maxLength={6}
            {...registerMfa('totpCode')}
            error={errorsMfa.totpCode?.message}
          />

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMfaRequired(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isLoading}>
              Verify
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Login
