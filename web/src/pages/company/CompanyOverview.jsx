import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import { RiskDonut } from '../../components/charts/RiskDonut'
import { motion } from 'framer-motion'
import { Users, Activity, TrendingUp, Shield } from 'lucide-react'
import api from '../../services/api'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.10 } } }
const item = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

export const CompanyOverview = () => {
  const { data: overview, isLoading } = useApi(
    ['company', 'overview'],
    () => api.get('/company/overview').then(r => r.data),
    { retry: 1, staleTime: 30_000 }
  )

  if (isLoading) return <LoadingScreen />

  const statCards = [
    { label: 'Total Employees',    value: overview?.totalEmployees ?? '—',   icon: Users,      gradient: 'linear-gradient(135deg,#7c3aed,#5b21b6)' },
    { label: 'Avg Wellness Score', value: overview?.avgWellnessScore != null ? Number(overview.avgWellnessScore).toFixed(1) : '—', icon: Shield, gradient: 'linear-gradient(135deg,#10b981,#059669)' },
    { label: 'Completion Rate',    value: overview?.completionRate != null ? `${Number(overview.completionRate).toFixed(0)}%` : '—', icon: Activity, gradient: 'linear-gradient(135deg,#0ea5e9,#0369a1)' },
    { label: 'At Risk',            value: overview?.needingAttention ?? '—', icon: TrendingUp, gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  ]

  return (
    <div className="relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div className="absolute w-80 h-80 rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle,#7c3aed,transparent)', top: '5%', right: '10%' }}
          animate={{ y: [0,-25,0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div className="absolute w-64 h-64 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle,#10b981,transparent)', bottom: '20%', left: '5%' }}
          animate={{ y: [0,20,0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        />
      </div>

      <motion.div className="space-y-8" variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <h1 className="text-3xl font-extrabold text-app mb-1">Company Overview</h1>
          <p className="text-gray-500 text-sm">Organisation-wide wellness at a glance</p>
        </motion.div>

        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" variants={container}>
          {statCards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.div key={card.label} variants={item}>
                <div className="rounded-2xl p-6 card-hover-lift cursor-default" style={{ background: card.gradient }}>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={item}>
            <Card className="p-6 card-hover-lift">
              <h3 className="text-lg font-semibold text-app mb-4 flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-cittaa-600" />
                Risk Distribution
              </h3>
              <RiskDonut data={overview?.riskDistribution} />
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="p-6 card-hover-lift">
              <h3 className="text-lg font-semibold text-app mb-4 flex items-center gap-2">
                <div className="w-2 h-5 rounded-full bg-green-500" />
                Wellbeing Summary
              </h3>
              {overview ? (
                <div className="space-y-4 mt-2">
                  {[
                    { label: 'Check-in Completion', value: overview.completionRate != null ? Number(overview.completionRate).toFixed(0) : 0, unit: '%', color: 'bg-cittaa-600' },
                    { label: 'Active Employees',    value: overview.totalEmployees ?? 0, unit: '', color: 'bg-blue-500' },
                    { label: 'Needing Attention',   value: overview.needingAttention ?? 0, unit: '', color: 'bg-orange-400' },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{row.label}</span>
                        <span className="font-semibold text-app">{row.value}{row.unit}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${row.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, Number(row.value))}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">No data available</p>
              )}
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default CompanyOverview
