import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, Button, LoadingScreen } from '../../components/ui'
import { Users, AlertCircle, Clock, FileText, Video, Loader2, Stethoscope } from 'lucide-react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import api from '../../services/api'
import toast from 'react-hot-toast'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.10 } } }
const item = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

const SEVERITY_COLORS = {
  critical: 'border-red-500 bg-red-50',
  high:     'border-orange-400 bg-orange-50',
  medium:   'border-yellow-400 bg-yellow-50',
  low:      'border-blue-400 bg-blue-50',
}
const SEVERITY_BADGE = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-blue-100 text-blue-700',
}

export const ClinicalDashboard = () => {
  const navigate = useNavigate()
  const [startingMeet, setStartingMeet] = useState(false)

  const handleInstantMeet = async () => {
    setStartingMeet(true)
    try {
      const res = await api.post('/consultations/instant-meet')
      const link = res.meetLink || res.data?.meetLink
      window.open(link, '_blank', 'noopener,noreferrer')
      toast.success('Instant Meet room opened!')
    } catch {
      toast.error('Could not create Meet room')
    } finally {
      setStartingMeet(false)
    }
  }

  const { data: statsResp, isLoading } = useApi(
    ['clinical', 'stats'],
    () => api.get('/clinical/stats'),
    { retry: 1, staleTime: 30_000 }
  )
  const stats = statsResp?.data

  const { data: scheduleResp } = useApi(
    ['clinical', 'schedule'],
    () => api.get('/clinical/schedule/today'),
    { retry: 1 }
  )
  const sessions = scheduleResp?.data || []

  const { data: alertsResp } = useApi(
    ['clinical', 'alerts'],
    () => api.get('/clinical/alerts?limit=5'),
    { retry: 1 }
  )
  const alertsList = alertsResp?.data || []

  if (isLoading) return <LoadingScreen />

  // Dynamic greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const statCards = [
    { label: "Today's Sessions",  value: stats?.upcomingConsultations ?? 0, icon: Clock,        bg: 'from-blue-500 to-blue-700' },
    { label: 'Active Alerts',     value: stats?.pendingAlerts ?? 0,          icon: AlertCircle,  bg: 'from-red-500 to-red-700' },
    { label: 'Patients at Risk',  value: stats?.riskBreakdown?.high ?? 0,    icon: Users,        bg: 'from-orange-500 to-orange-700' },
    { label: 'Total Sessions',    value: stats?.totalSessions ?? 0,          icon: FileText,     bg: 'from-purple-500 to-purple-700' },
  ]

  return (
    <div className="relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div className="absolute w-80 h-80 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle,#6366f1,transparent)', top: '3%', right: '12%' }}
          animate={{ y: [0,-28,0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div className="absolute w-64 h-64 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle,#ec4899,transparent)', bottom: '18%', left: '3%' }}
          animate={{ y: [0,22,0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      <motion.div className="space-y-8" variants={container} initial="hidden" animate="show">

        {/* Welcome header */}
        <motion.div variants={item} className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-app mb-1">{greeting}, Dr. Clinician</h1>
            <p className="text-gray-500 text-sm">Here's what's happening with your patients today</p>
          </div>
          {/* Quick action buttons */}
          <div className="flex gap-3 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/clinical/assessment/new')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}
            >
              <Stethoscope className="w-4 h-4" />
              New Assessment
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleInstantMeet}
              disabled={startingMeet}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg,#1a73e8,#1558b0)' }}
            >
              {startingMeet
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
                : <><Video className="w-4 h-4" /> Instant Meet</>}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/clinical/alerts')}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View Alerts
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/clinical/patients')}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Patient Registry
            </motion.button>
          </div>
        </motion.div>

        {/* Stat cards */}
        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" variants={container}>
          {statCards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.div key={card.label} variants={item}>
                <div className={`bg-gradient-to-br ${card.bg} rounded-2xl p-6 card-hover-lift cursor-default`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-white/70 font-medium mb-1">{card.label}</p>
                      <motion.p
                        className="text-4xl font-extrabold text-white"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.07, duration: 0.45, ease: 'backOut' }}
                      >
                        {card.value}
                      </motion.p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Schedule + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Today's Schedule */}
          <motion.div variants={item}>
            <Card className="p-6 card-hover-lift h-full">
              <CardTitle className="mb-4 flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-blue-500" />
                Today's Schedule
              </CardTitle>
              {sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.slice(0, 5).map((session, idx) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.07 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-app text-sm">{session.patient?.name || 'Patient'}</p>
                        <p className="text-xs text-gray-500">
                          {session.scheduledAt ? format(new Date(session.scheduledAt), 'HH:mm') : '—'}
                        </p>
                      </div>
                      <span className="text-xs px-2.5 py-1 bg-cittaa-100 text-cittaa-700 rounded-full capitalize font-medium">
                        {session.consultationType || session.mode || 'online'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-gray-400 text-sm">No sessions scheduled for today</p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Recent Alerts */}
          <motion.div variants={item}>
            <Card className="p-6 card-hover-lift h-full">
              <CardTitle className="mb-4 flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-red-500" />
                Recent Alerts
              </CardTitle>
              {alertsList.length > 0 ? (
                <div className="space-y-3">
                  {alertsList.slice(0, 5).map((alert, idx) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.07 }}
                      className={`flex items-center justify-between p-3 border-l-4 rounded-xl ${SEVERITY_COLORS[alert.severity] || 'border-gray-300 bg-gray-50'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-app text-sm truncate">{alert.patientName || alert.employeeId}</p>
                        <p className="text-xs text-gray-500 truncate">{alert.message}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ml-3 font-medium capitalize ${SEVERITY_BADGE[alert.severity] || 'bg-gray-100 text-gray-600'}`}>
                        {alert.severity}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-gray-400 text-sm">No active alerts — all patients stable</p>
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default ClinicalDashboard
