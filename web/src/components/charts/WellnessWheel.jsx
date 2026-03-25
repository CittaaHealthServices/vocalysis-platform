import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from 'recharts'

export const WellnessWheel = ({ data = [], size = 'md' }) => {
  const chartData = data.length > 0 ? data : [
    { category: 'Physical Health', value: 0 },
    { category: 'Mental Health', value: 0 },
    { category: 'Sleep Quality', value: 0 },
    { category: 'Stress Levels', value: 0 },
    { category: 'Social Connection', value: 0 },
    { category: 'Work-Life Balance', value: 0 },
  ]

  const height = size === 'sm' ? 300 : size === 'md' ? 400 : 500

  return (
    <div className="w-full h-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="#E5E3F0" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill: '#1E1B2E', fontSize: 12 }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} />
          <Radar
            name="Wellness Score"
            dataKey="value"
            stroke="#6B21A8"
            fill="#A855F7"
            fillOpacity={0.6}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default WellnessWheel
