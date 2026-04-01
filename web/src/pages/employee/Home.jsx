import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, ArrowRight, Calendar, CheckCircle2 } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { ScoreGauge } from '../../components/charts/ScoreGauge'
import api from '../../services/api'

// Floating background orb
function Orb({ className, delay = 0 }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`}
      animate={{ y: [0, -28, 0], x: [0, 18, 0], scale: [1, 1.06, 1] }}
      transition={{ duration: 9 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  )
}

// Trend badge — uses proper icons, no corrupted Unicode
function TrendBadge({ trend }) {
  if (trend === 'improving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1 text-sm font-medium">
        <TrendingUp className="w-4 h-4" /> Improving since last check-in
      </span>
    )
  }
  if (trend === 'stable') {
    return (
      <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-sm font-medium">
        <Minus className="w-4 h-4" /> Stable
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-sm font-medium">
      <TrendingDown className="w-4 h-4" /> Declining — check-in recommended
    </span>
  )
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export const MyWellnessHome = () => {
  const navigate = useNavigate()
  const { data: wellnessResponse, isLoading } = useApi(['wellness', 'home'], () => api.get('/my/wellness'))
  const wellness = wellnessResponse?.data

  if (isLoading) return <LoadingScreen />

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="relative">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <Orb className="w-72 h-72 bg-cittaa-300 top-10 -right-20"    delay={0} />
        <Orb className="w-96 h-96 bg-blue-200    -bottom-20 -left-20" delay={2} />
        <Orb className="w-48 h-48 bg-purple-200  top-1/2 left-1/3"   delay={4} />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative space-y-8"
      >
        {/* Greeting */}
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-bold text-app mb-1">
            {greeting}, {wellness?.firstName || 'Demo'}!
          </h1>
          <p className="text-gray-500">How are you feeling today?</p>
        </motion.div>

        {/* Wellness Score Card */}
        <motion.div variants={itemVariants}>
          <div
            className="relative overflow-hidden rounded-2xl p-8 shadow-xl"
            style={{ background: 'linear-gradient(135deg, #7e22ce 0%, #6b21a8 40%, #1e40af 100%)' }}
          >
            {/* Inner decorative orbs */}
            <div className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl opacity-20 bg-white pointer-events-none" />
            <div className="absolute -bottom-10 left-1/2 w-40 h-40 rounded-full blur-2xl opacity-10 bg-blue-200 pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-3">Your Wellness Score</h2>
                <div className="mb-6">
                  <TrendBadge trend={wellness?.trend} />
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/my/check-in')}
                  className="!bg-white !text-cittaa-700 hover:!bg-gray-50 !border-0 font-semibold shadow-md inline-flex items-center gap-2"
                >
                  Begin Wellness Check-in
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-shrink-0">
                <ScoreGauge score={wellness?.wellnessScore || 50} label="Overall" size="lg" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Next Assessment */}
          {wellness?.nextAssessment && (
            <motion.div variants={itemVariants}>
              <Card className="p-6 card-hover-lift h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-app">Next Assessment</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Scheduled for{' '}
                  <span className="font-medium text-app">
                    {new Date(wellness.nextAssessment).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </p>
                <Button variant="secondary" className="w-full" size="sm" onClick={() => navigate('/my/check-in')}>
                  Reschedule
                </Button>
              </Card>
            </motion.div>
          )}

          {/* Recent Check-ins */}
          <motion.div variants={itemVariants}>
            <Card className="p-6 card-hover-lift h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-app">Recent Check-ins</h3>
              </div>
              <div className="space-y-2">
                {wellness?.recentSessions?.length > 0 ? wellness.recentSessions.map((checkin, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
                    <span className="text-gray-500">
                      {new Date(checkin.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="font-semibold text-cittaa-700">
                      {checkin.score} <span className="text-xs text-gray-400 font-normal">/ 100</span>
                    </span>
                  </div>
                )) : (
                  <div className="py-6 text-center">
                    <div className="text-3xl mb-2">🎯</div>
                    <p className="text-sm text-gray-500">No check-ins yet — start your first one!</p>
                    <button
                      onClick={() => navigate('/my/check-in')}
                      className="mt-3 text-sm text-cittaa-700 font-medium hover:underline"
                    >
                      Begin now →
                    </button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Upcoming Consultations */}
        {wellness?.upcomingConsultations?.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="p-6 card-hover-lift">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-app">Upcoming Consultations</h3>
                <button onClick={() => navigate('/my/consultations')} className="text-sm text-cittaa-700 font-medium hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {wellness.upcomingConsultations.map((consultation, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 + 0.3 }}
                    className="p-4 bg-gradient-to-r from-blue-50 to-sky-50 rounded-xl border border-blue-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-app">
                        {consultation.clinicianId?.firstName
                          ? `${consultation.clinicianId.firstName} ${consultation.clinicianId.lastName}`
                          : 'Clinician TBD'}
                      </p>
                      <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full">Upcoming</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      {new Date(consultation.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                      at {new Date(consultation.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {consultation.meetLink && (
                      <button
                        onClick={() => window.open(consultation.meetLink, '_blank', 'noopener,noreferrer')}
                        className="flex items-center gap-2 w-full justify-center py-2 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #1a73e8, #1558b0)' }}
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5">
                          <path d="M22.5 12.23c0-.64-.06-1.25-.16-1.84H12v3.48h5.9a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-7.73z" fill="white"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
                          <path d="M5.84 14.09a6.94 6.94 0 0 1 0-4.18V7.07H2.18a11.09 11.09 0 0 0 0 9.86l3.66-2.84z" fill="white"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
                        </svg>
                        Join Google Meet
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

export default MyWellnessHome
