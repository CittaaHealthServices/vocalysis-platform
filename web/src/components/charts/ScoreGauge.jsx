import { motion } from 'framer-motion'

export const ScoreGauge = ({
  score = 50,
  label = 'Score',
  size = 'md',
  showBands = true,
  maxScore = 100,
}) => {
  // Determine color based on score context
  const getColor = () => {
    if (score <= 30) return '#22C55E' // green - minimal
    if (score <= 50) return '#84CC16' // yellow-green - mild
    if (score <= 75) return '#F59E0B' // amber - moderate
    return '#EF4444' // red - severe
  }

  const getSeverity = () => {
    if (score <= 30) return 'Minimal'
    if (score <= 50) return 'Mild'
    if (score <= 75) return 'Moderate'
    return 'Severe'
  }

  const sizeMap = {
    sm: { radius: 45, circumference: 282.6 },
    md: { radius: 60, circumference: 376.8 },
    lg: { radius: 75, circumference: 471 },
  }

  const { radius, circumference } = sizeMap[size]
  const strokeDashoffset = circumference - (score / maxScore) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative inline-flex items-center justify-center">
        <svg width={radius * 2} height={radius * 2} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={radius}
            cy={radius}
            r={radius - 10}
            fill="none"
            stroke="#E5E3F0"
            strokeWidth="8"
          />

          {/* Score circle */}
          <motion.circle
            cx={radius}
            cy={radius}
            r={radius - 10}
            fill="none"
            stroke={getColor()}
            strokeWidth="8"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            strokeLinecap="round"
          />

          {/* Bands if needed */}
          {showBands && (
            <>
              {[0, 25, 50, 75].map((band, i) => {
                const angle = (band / 100) * 180
                const rad = (angle * Math.PI) / 180
                const x1 = radius + (radius - 15) * Math.cos(rad)
                const y1 = radius + (radius - 15) * Math.sin(rad)
                const x2 = radius + (radius + 5) * Math.cos(rad)
                const y2 = radius + (radius + 5) * Math.sin(rad)
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#9F97AF"
                    strokeWidth="2"
                  />
                )
              })}
            </>
          )}
        </svg>

        {/* Center text */}
        <div className="absolute text-center">
          <motion.p
            className="text-2xl md:text-3xl font-bold text-app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {score}
          </motion.p>
          <p className="text-xs md:text-sm text-gray-500 mt-1">{maxScore === 100 ? '%' : ''}</p>
        </div>
      </div>

      {/* Labels */}
      <div className="mt-4 text-center">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className="text-xs text-gray-500 mt-1">{getSeverity()}</p>
      </div>
    </div>
  )
}

export default ScoreGauge
