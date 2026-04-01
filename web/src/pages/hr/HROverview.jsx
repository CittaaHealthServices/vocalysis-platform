import { useApi } from '../../hooks/useApi'
import { Card, CardTitle, Button, LoadingScreen } from '../../components/ui'
import { RiskDonut } from '../../components/charts/RiskDonut'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { Users, Activity, Bell, Shield } from 'lucide-react'
import api from '../../services/api'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.10 } } }
const item = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

function StatCard({ label, value, icon: Icon, gradient }) {
  return (
    <motion.div variants={item}>
      <div className="rounded-2xl p-6 relative overflow-hidden card-hover-lift cursor-default" style={{ background: gradient }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-white/70 font-medium mb-1">{label}</p>
            <motion.p
              className="text-4xl font-extrabold text-white"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.5, ease: 'backOut' }}
            >
              {value ?? '—'}
            </motion.p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export const HROverview = () => {
  const { data: overview, isLoading } = useApi(
    ['hr', 'overview'],
    () => api.get('/analytics/overview').then(r => r.data),
    { retry: 1, staleTime: 30_000 }
  )

  if (isLoading) return <LoadingScreen />

  const statCards = [
    { label: 'Total Employees',    value: overview?.totalEmployees ?? 0,   icon: Users,    gradient: 'linear-gradient(135deg,#7c3aed,#5b21b6)' },
    { label: 'Assessed This Month',value: overview?.assessedThisMonth ?? 0, icon: Activity, gradient: 'linear-gradient(135deg,#0ea5e9,#0369a1)' },
    { label: 'Needing Attention',  value: overview?.needingAttention ?? 0,  icon: Bell,     gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
    { label: 'Avg Wellness Score', value: overview?.avgWellnessScore != null ? Number(overview.avgWellnessScore).toFixed(1) : '—', icon: Shield, gradient: 'linear-gradient(135deg,#10b981,#059669)' },
  ]

  return (
    <div className="relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div className="absolute w-96 h-96 rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle,#7c3aed,transparent)', top: '2%', right: '8%' }}
          animate={{ y: [0,-30,0], x: [0,15,0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div className="absolute w-72 h-72 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle,#0ea5e9,transparent)', bottom: '15%', left: '4%' }}
          animate={{ y: [0,25,0], x: [0,-20,0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div className="space-y-8" variants={container} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={item}>
          <h1 className="text-3xl font-extrabold text-app mb-1">HR Wellness Overview</h1>
          <p className="text-gray-500 text-sm">Real-time workforce wellbeing insights for your organisation</p>
        </motion.div>

        {/* Stat cards */}
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" variants={container}>
          {statCards.map(card => <StatCard key={card.label} {...card} />)}
        </motion.div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={item}>
            <Card className="p-6 card-hover-lift">
              <CardTitle className="mb-4 flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-cittaa-600" />
                Employee Risk Distribution
              </CardTitle>
              <RiskDonut data={overview?.riskDistribution} />
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="p-6 card-hover-lift">
              <CardTitle className="mb-4 flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-blue-500" />
                Assessment Activity
              </CardTitle>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overview?.activityData || []}>
                  <CartesianGrid stroke="#E5E3F0" strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              {(!overview?.activityData || overview.activityData.length === 0) && (
                <p className="text-gray-400 text-sm text-center py-8">No activity data yet — check-ins will appear here</p>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Pending Actions */}
        <motion.div variants={item}>
          <Card className="p-6">
            <CardTitle className="mb-4 flex items-center gap-2">
              <div className="w-2 h-5 rounded-full bg-orange-500" />
              Pending Actions
            </CardTitle>
            {overview?.pendingActions?.length > 0 ? (
              <div className="space-y-3">
                {overview.pendingActions.map((action, idx) => (
                  <motion.div key={idx}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-app text-sm font-medium">{action.title}</span>
                    <Button size="sm" variant="primary">Action</Button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div className="text-center py-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-gray-500 text-sm">All clear — no pending actions</p>
              </motion.div>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default HROverview
