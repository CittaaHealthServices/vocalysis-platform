import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Brain, HeartPulse, Shield, Sparkles, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'
import api from '../../services/api'
import toast from 'react-hot-toast'

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

export default function Register() {
  const navigate = useNavigate()
  const [vals, setVals] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' })
  const [errs, setErrs] = useState({})
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const set = (field) => (e) => {
    setVals(v => ({ ...v, [field]: e.target.value }))
    if (errs[field]) setErrs(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!vals.firstName.trim())  e.firstName = 'First name is required'
    if (!vals.lastName.trim())   e.lastName  = 'Last name is required'
    if (!vals.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals.email))
      e.email = 'Valid email is required'
    if (!vals.password || vals.password.length < 10)
      e.password = 'Password must be at least 10 characters'
    else if (!/[A-Z]/.test(vals.password))
      e.password = 'Must include an uppercase letter'
    else if (!/[a-z]/.test(vals.password))
      e.password = 'Must include a lowercase letter'
    else if (!/[0-9]/.test(vals.password))
      e.password = 'Must include a number'
    else if (!/[!@#$%^&*]/.test(vals.password))
      e.password = 'Must include a special character (!@#$%^&*)'
    if (vals.confirmPassword !== vals.password)
      e.confirmPassword = 'Passwords do not match'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) { setErrs(errors); return }

    setLoading(true)
    try {
      await api.post('/auth/register/self', {
        firstName: vals.firstName.trim(),
        lastName:  vals.lastName.trim(),
        email:     vals.email.trim().toLowerCase(),
        password:  vals.password,
      })
      setSubmitted(true)   // show pending-approval screen
    } catch (err) {
      const msg = err?.error?.message || err?.message || 'Registration failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }


  // ── Pending approval screen ───────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-200">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <Shield className="w-10 h-10 text-white" />
            </motion.div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Thank you for signing up for <strong>Vocalysis</strong>. Your account is currently
            <span className="text-violet-700 font-semibold"> under review </span>
            by our team. We'll send you an email at
            <span className="text-gray-800 font-medium"> {vals.email} </span>
            once it's approved.
          </p>

          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-6 text-left space-y-2">
            {[
              '✅ Application received successfully',
              '📧 Check your inbox for a confirmation email',
              '⏱️ Typical review time: 1–2 business days',
              '🔔 You'll be notified by email when approved',
            ].map(s => (
              <p key={s} className="text-sm text-violet-800">{s}</p>
            ))}
          </div>

          <p className="text-sm text-gray-400">
            Questions?{' '}
            <a href="mailto:support@cittaa.in" className="text-violet-600 hover:text-violet-700 font-medium">
              support@cittaa.in
            </a>
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 flex-col items-center justify-center p-12 overflow-hidden">
        <Orb className="bg-violet-400 top-10 left-10" delay={0} size="lg" />
        <Orb className="bg-purple-400 bottom-20 right-10" delay={2} size="md" />
        <Orb className="bg-indigo-400 top-1/2 left-1/3" delay={4} size="sm" />

        <div className="relative z-10 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/30">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Kaushan Script', cursive" }}>
            Vocalysis
          </h1>
          <p className="text-white/80 text-lg mb-8">AI-powered workplace mental health</p>

          <div className="space-y-3">
            {[
              { icon: HeartPulse, label: 'Voice biomarker analysis' },
              { icon: Shield,     label: 'Private & confidential' },
              { icon: Sparkles,   label: 'Personalised wellness insights' },
            ].map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.15 }}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/90 text-sm font-medium">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo (mobile) */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Brain className="w-7 h-7 text-violet-600" />
            <span className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Kaushan Script', cursive" }}>Vocalysis</span>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-violet-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            </div>
            <p className="text-gray-500 text-sm">Join Vocalysis and start your wellness journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                <input
                  type="text"
                  value={vals.firstName}
                  onChange={set('firstName')}
                  placeholder="Sairam"
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition ${
                    errs.firstName ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                />
                {errs.firstName && <p className="text-xs text-red-500 mt-1">{errs.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                <input
                  type="text"
                  value={vals.lastName}
                  onChange={set('lastName')}
                  placeholder="Kumar"
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition ${
                    errs.lastName ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                />
                {errs.lastName && <p className="text-xs text-red-500 mt-1">{errs.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address *</label>
              <input
                type="email"
                value={vals.email}
                onChange={set('email')}
                placeholder="you@example.com"
                className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition ${
                  errs.email ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              />
              {errs.email && <p className="text-xs text-red-500 mt-1">{errs.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={vals.password}
                  onChange={set('password')}
                  placeholder="Min. 10 chars, uppercase, number, symbol"
                  className={`w-full px-3 py-2.5 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition ${
                    errs.password ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errs.password && <p className="text-xs text-red-500 mt-1">{errs.password}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password *</label>
              <input
                type="password"
                value={vals.confirmPassword}
                onChange={set('confirmPassword')}
                placeholder="Re-enter your password"
                className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition ${
                  errs.confirmPassword ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              />
              {errs.confirmPassword && <p className="text-xs text-red-500 mt-1">{errs.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold rounded-xl shadow-md hover:from-violet-700 hover:to-purple-800 transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-600 font-semibold hover:text-violet-700">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
