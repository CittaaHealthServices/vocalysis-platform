import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Shield, Brain, HeartPulse, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

// Animated floating orb
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

// Floating feature badge
function FeatureBadge({ icon: Icon, label, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.6 }}
      className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3"
    >
      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-white/90 text-sm font-medium">{label}</span>
    </motion.div>
  )
}

// Animated stat card
function StatCard({ value, label, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className="text-center"
    >
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-white/60 text-xs mt-1">{label}</div>
    </motion.div>
  )
}

export const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(loginSchema) })
  const { register: registerMfa, handleSubmit: handleSubmitMfa, formState: { errors: errorsMfa }, reset: resetMfa } = useForm({ resolver: zodResolver(totpSchema) })

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
    <div className="min-h-screen flex overflow-hidden" style={{ background: '#0f0a1e' }}>

      {/* ── Left panel — brand & visuals ───────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #2d1060 0%, #4c1d95 40%, #1e1b4b 100%)' }}>

        {/* Animated orbs */}
        <Orb className="bg-violet-400 top-[-10%] left-[-10%]" size="xl" delay={0} />
        <Orb className="bg-purple-600 bottom-[-5%] right-[-5%]" size="xl" delay={2} />
        <Orb className="bg-indigo-500 top-[40%] right-[10%]" size="md" delay={4} />
        <Orb className="bg-fuchsia-500 bottom-[30%] left-[5%]" size="sm" delay={1} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-10"
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Top: Logo */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
                    className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center">
            <span className="text-white font-black text-lg" style={{ fontFamily: "'Kaushan Script', cursive" }}>C</span>
          </div>
          <div>
            <span className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: "'Kaushan Script', cursive" }}>Cittaa</span>
            <span className="ml-2 text-xs text-white/50 font-medium">by Vocalysis</span>
          </div>
        </motion.div>

        {/* Center: Hero content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-16">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-violet-300 uppercase tracking-widest mb-6 bg-violet-500/20 border border-violet-400/30 rounded-full px-4 py-1.5">
              <Sparkles className="w-3 h-3" /> AI-Powered Mental Wellness
            </span>
            <h1 className="text-5xl font-black text-white leading-tight mb-6">
              Transform your<br />
              <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                Workforce Wellbeing
              </span>
            </h1>
            <p className="text-white/60 text-lg leading-relaxed max-w-md">
              Clinical-grade analytics and AI insights to support your team's mental health journey — proactively.
            </p>
          </motion.div>

          {/* Feature list */}
          <div className="flex flex-col gap-3 mt-10">
            <FeatureBadge icon={Brain}       label="AI-powered mood & sentiment analysis"     delay={0.5} />
            <FeatureBadge icon={HeartPulse}  label="Real-time wellbeing risk monitoring"       delay={0.7} />
            <FeatureBadge icon={Shield}      label="HIPAA-compliant & fully encrypted"         delay={0.9} />
          </div>
        </div>

        {/* Bottom: Stats bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.8 }}
                    className="relative z-10 border-t border-white/10 pt-8 grid grid-cols-3 gap-6">
          <StatCard value="98%"  label="Client Satisfaction" delay={1.3} />
          <StatCard value="50K+" label="Employees Supported" delay={1.4} />
          <StatCard value="<2ms" label="Real-time Analytics"  delay={1.5} />
        </motion.div>
      </div>

      {/* ── Right panel — login form ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative"
           style={{ background: 'linear-gradient(180deg, #1a0d30 0%, #0f0a1e 100%)' }}>

        {/* Subtle glow behind card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md"
        >
          {/* Card */}
          <div className="rounded-2xl border border-white/10 p-8 lg:p-10"
               style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)' }}>

            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                <span className="text-white font-black text-base" style={{ fontFamily: "'Kaushan Script', cursive" }}>C</span>
              </div>
              <span className="text-white font-bold text-lg" style={{ fontFamily: "'Kaushan Script', cursive" }}>Cittaa <span className="text-white/40 font-normal text-sm" style={{ fontFamily: 'inherit' }}>by Vocalysis</span></span>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                         className="text-2xl lg:text-3xl font-bold text-white">
                Welcome back
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                        className="text-white/50 mt-2 text-sm">
                Sign in to your Vocalysis account
              </motion.p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Email address</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  {...register('email')}
                  className="w-full px-4 py-3 rounded-xl text-white text-sm placeholder-white/25 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••"
                    {...register('password')}
                    className="w-full px-4 py-3 pr-12 rounded-xl text-white text-sm placeholder-white/25 border border-white/10 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                    style={{ background: 'rgba(255,255,255,0.07)' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                          className="flex justify-end">
                <a href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  Forgot password?
                </a>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm relative overflow-hidden transition-all disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6)' }}
              >
                {/* Shimmer effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                   className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
                      Signing in…
                    </>
                  ) : 'Sign In'}
                </span>
              </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/25 text-xs">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Google Sign-In */}
            <motion.button
              type="button"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              onClick={async () => {
                try {
                  const res = await import('../../services/api').then(m => m.default.get('/auth/google/login'))
                  if (res?.data?.url) window.location.href = res.data.url
                } catch {}
              }}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold text-white/80 transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {/* Google G icon */}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </motion.button>

            {/* Security note */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                        className="flex items-center gap-2 text-xs text-white/30 justify-center mt-4">
              <Shield className="w-3 h-3" />
              <span>256-bit encrypted · HIPAA compliant · SOC 2 audited</span>
            </motion.div>
          </div>

          {/* Bottom note */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                    className="text-center text-white/25 text-xs mt-6">
            Having trouble signing in? Contact your administrator.
          </motion.p>
        </motion.div>
      </div>

      {/* MFA Modal */}
      <Modal isOpen={mfaRequired} onClose={() => setMfaRequired(false)} title="Two-Factor Authentication">
        <p className="text-gray-600 mb-4 text-sm">Enter the 6-digit code from your authenticator app</p>
        <form onSubmit={handleSubmitMfa(onSubmitMfa)} className="space-y-4">
          <Input label="TOTP Code" type="text" placeholder="000000" maxLength={6}
                 {...registerMfa('totpCode')} error={errorsMfa.totpCode?.message} />
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setMfaRequired(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isLoading}>Verify</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Login
