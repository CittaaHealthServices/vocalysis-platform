import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'

export const TrendLine = ({ data = [], title, hasReference = true }) => {
  const chartData = data.map((item) => ({
    ...item,
    date: item.date ? format(new Date(item.date), 'MMM dd') : '',
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-lg">
          <p className="text-sm font-medium text-app">{payload[0].payload.date}</p>
          <p className="text-sm text-cittaa-700">Score: {payload[0].value}</p>
          {payload[0].payload.category && (
            <p className="text-xs text-gray-600">{payload[0].payload.category}</p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-full">
      {title && <h3 className="mb-4 text-lg font-semibold text-app">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid stroke="#E5E3F0" />
          <XAxis dataKey="date" stroke="#9F97AF" />
          <YAxis stroke="#9F97AF" domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* Severity bands as reference lines */}
          {hasReference && (
            <>
              <ReferenceLine y={30} stroke="#84CC16" strokeDasharray="5 5" label="Mild Threshold" />
              <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="5 5" label="Moderate Threshold" />
              <ReferenceLine y={75} stroke="#EF4444" strokeDasharray="5 5" label="Severe Threshold" />
            </>
          )}

          <Line
            type="monotone"
            dataKey="score"
            stroke="#6B21A8"
            strokeWidth={2}
            dot={{ fill: '#6B21A8', r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TrendLine
