import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Shield, Mail, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
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

export const ForgotPassword = () => {
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setIsLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: data.email })
      setSentEmail(data.email)
      setSubmitted(true)
    } catch {
      // Always show success (security — don't reveal if email exists)
      setSentEmail(data.email)
      setSubmitted(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative p-4"
         style={{ background: 'linear-gradient(180deg, #1a0d30 0%, #0f0a1e 100%)' }}>

      {/* Background orbs */}
      <Orb className="bg-violet-400 top-[-10%] left-[-10%]"  size="xl" delay={0} />
      <Orb className="bg-purple-600 bottom-[-5%] right-[-5%]" size="xl" delay={2} />
      <Orb className="bg-indigo-500 top-[40%] right-[10%]"   size="md" delay={4} />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-5"
           style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Glow behind card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
           style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md z-10"
      >
        {/* Card */}
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

          {!submitted ? (
            <>
              <div className="mb-8">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-violet-300 uppercase tracking-widest mb-4 bg-violet-500/20 border border-violet-400/30 rounded-full px-3 py-1">
                    <Sparkles className="w-3 h-3" /> Account Recovery
                  </span>
                  <h2 className="text-2xl lg:text-3xl font-bold text-white">Forgot your password?</h2>
                  <p className="text-white/50 mt-2 text-sm leading-relaxed">
                    No problem. Enter your email and we'll send you a secure reset link.
                  </p>
                </motion.div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      {...register('email')}
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-white text-sm placeholder-white/25 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    />
                  </div>
                  {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
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
                        Sending…
                      </>
                    ) : 'Send Reset Link'}
                  </span>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white/90 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Sign In
                </motion.button>
              </form>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-400/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Check your inbox</h2>
                <p className="text-white/50 text-sm leading-relaxed">
                  If <strong className="text-white/70">{sentEmail}</strong> is registered with Cittaa, you'll receive a reset link within a minute.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-violet-400/20 mb-6"
                   style={{ background: 'rgba(139,92,246,0.08)' }}>
                <p className="text-white/50 text-xs text-center">
                  The link expires in <strong className="text-violet-300">60 minutes</strong>. Check your spam folder if you don't see it.
                </p>
              </div>

              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6)' }}
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </motion.div>
          )}

          {/* Security note */}
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

export default ForgotPassword
