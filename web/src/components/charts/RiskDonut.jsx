import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'

export const RiskDonut = ({ data = [], title = 'Risk Distribution' }) => {
  const defaultData = [
    { name: 'Thriving', value: 0, color: '#22C55E' },
    { name: 'Doing Well', value: 0, color: '#0EA5E9' },
    { name: 'Needs Attention', value: 0, color: '#F59E0B' },
    { name: 'Support Needed', value: 0, color: '#EF4444' },
  ]

  const chartData = data.length > 0 ? data : defaultData

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload[0]) {
      const { name, value } = payload[0]
      const percentage = ((value / total) * 100).toFixed(1)
      return (
        <div className="bg-white p-2 rounded border border-gray-200 shadow">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-sm text-gray-600">{value} ({percentage}%)</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-full">
      {title && <h3 className="mb-4 text-lg font-semibold text-app text-center">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || '#6B21A8'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" height={36} />

          {/* Center label */}
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="font-bold text-2xl">
            {total}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RiskDonut
