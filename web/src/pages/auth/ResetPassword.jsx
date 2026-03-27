import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, CheckCircle2, KeyRound, AlertCircle } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

// Must match backend _isValidPassword: 10+ chars, upper, lower, digit, special
const schema = z
  .object({
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[@$!%*?&^#()_\-+=]/, 'Must contain a special character (@$!%*?& etc.)'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

function Orb({ className, delay = 0, size = 'md' }) {
  const sizes = { sm: 'w-32 h-32', md: 'w-56 h-56', lg: 'w-80 h-80', xl: 'w-96 h-96' }
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-30 ${sizes[size]} ${className}`}
      animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.05, 1] }}
      transition={{ duration: 8 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  )
}

/* Strength meter */
function StrengthBar({ password }) {
  let score = 0
  if (password.length >= 10)               score++
  if (/[A-Z]/.test(password))              score++
  if (/[a-z]/.test(password))              score++
  if (/[0-9]/.test(password))              score++
  if (/[@$!%*?&^#()_\-+=]/.test(password)) score++

  const labels = ['', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981']

  if (!password) return null
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
               style={{ background: i <= score ? colors[score] : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color: colors[score] || 'rgba(255,255,255,0.3)' }}>
        {labels[score]}
      </p>
    </div>
  )
}

export const ResetPassword = () => {
  const navigate = useNavigate()
  const { token } = useParams()
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [showPw, setShowPw]   = useState(false)
  const [showCpw, setShowCpw] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const passwordVal = watch('password', '')

  const onSubmit = async (data) => {
    if (!token) {
      toast.error('Reset link is invalid or expired. Please request a new one.')
      return
    }
    setIsLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password: data.password })
      setDone(true)
    } catch (err) {
      const msg = err?.error?.message || err?.message || 'Reset failed. The link may have expired.'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative p-4"
         style={{ background: 'linear-gradient(180deg, #1a0d30 0%, #0f0a1e 100%)' }}>

      <Orb className="bg-violet-400 top-[-10%] left-[-10%]"  size="xl" delay={0} />
      <Orb className="bg-purple-600 bottom-[-5%] right-[-5%]" size="xl" delay={2} />
      <Orb className="bg-indigo-500 top-[40%] right-[10%]"   size="md" delay={4} />

      <div className="absolute inset-0 opacity-5"
           style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
           style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md z-10"
      >
        <div className="rounded-2xl border border-white/10 p-8 lg:p-10"
             style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)' }}>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <span className="text-white font-black text-base" style={{ fontFamily: "'Kaushan Script', cursive" }}>C</span>
            </div>
            <span className="text-white font-bold text-lg" style={{ fontFamily: "'Kaushan Script', cursive" }}>
              Cittaa <span className="text-white/40 font-normal text-sm">by Vocalysis</span>
            </span>
          </div>

          {/* No token guard */}
          {!token ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Invalid reset link</h2>
              <p className="text-white/50 text-sm mb-6">This link is missing a token. Please request a new password reset.</p>
              <button onClick={() => navigate('/forgot-password')}
                      className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                Request New Link
              </button>
            </div>
          ) : done ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-400/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Password updated!</h2>
                <p className="text-white/50 text-sm">Your password has been reset successfully. You can now sign in with your new password.</p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6)' }}
              >
                Sign In Now →
              </button>
            </motion.div>
          ) : (
            <>
              <div className="mb-8">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center mb-4">
                    <KeyRound className="w-6 h-6 text-violet-300" />
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold text-white">Create new password</h2>
                  <p className="text-white/50 mt-2 text-sm">Choose something strong that you haven't used before.</p>
                </motion.div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Password */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••••"
                      {...register('password')}
                      className="w-full px-4 py-3 pr-12 rounded-xl text-white text-sm placeholder-white/25 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                      {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password
                    ? <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
                    : <p className="text-white/30 text-xs mt-1.5">Min 10 chars · uppercase · lowercase · number · special character</p>
                  }
                  <StrengthBar password={passwordVal} />
                </motion.div>

                {/* Confirm */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showCpw ? 'text' : 'password'}
                      placeholder="••••••••••"
                      {...register('confirmPassword')}
                      className="w-full px-4 py-3 pr-12 rounded-xl text-white text-sm placeholder-white/25 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    />
                    <button type="button" onClick={() => setShowCpw(!showCpw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                      {showCpw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-400 text-xs mt-1.5">{errors.confirmPassword.message}</p>}
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl text-white font-semibold text-sm relative overflow-hidden transition-all disabled:opacity-70"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6)' }}
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                     className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
                        Updating…
                      </>
                    ) : 'Set New Password'}
                  </span>
                </motion.button>

                <button type="button" onClick={() => navigate('/login')}
                        className="w-full py-3 text-sm text-white/40 hover:text-white/70 transition-colors">
                  ← Back to Sign In
                </button>
              </form>
            </>
          )}

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                      className="flex items-center gap-2 text-xs text-white/25 justify-center mt-6">
            <Shield className="w-3 h-3" />
            <span>256-bit encrypted · HIPAA compliant</span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default ResetPassword
