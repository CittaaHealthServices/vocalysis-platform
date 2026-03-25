import { useEffect, useState, useCallback } from 'react'

export const usePolling = (pollFn, condition, interval = 3000, maxDuration = 600000) => {
  const [isPolling, setIsPolling] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [completed, setCompleted] = useState(false)
  const [progress, setProgress] = useState(0)

  const startPolling = useCallback(async () => {
    setIsPolling(true)
    setError(null)
    setCompleted(false)
    setProgress(0)

    const startTime = Date.now()
    const pollInterval = setInterval(async () => {
      try {
        const result = await pollFn()
        setData(result)

        const elapsedTime = Date.now() - startTime
        setProgress(Math.min((elapsedTime / maxDuration) * 100, 95))

        if (condition(result)) {
          setCompleted(true)
          setProgress(100)
          clearInterval(pollInterval)
          setIsPolling(false)
        }

        if (elapsedTime > maxDuration) {
          setError('Polling timeout exceeded')
          clearInterval(pollInterval)
          setIsPolling(false)
        }
      } catch (err) {
        setError(err.message || 'Polling error')
        clearInterval(pollInterval)
        setIsPolling(false)
      }
    }, interval)

    return () => clearInterval(pollInterval)
  }, [pollFn, condition, interval, maxDuration])

  return {
    isPolling,
    data,
    error,
    completed,
    progress,
    startPolling,
  }
}
