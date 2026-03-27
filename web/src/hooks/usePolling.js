import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * usePolling — polls an async function until a condition is met.
 *
 * @param {Function} pollFn       Async function that returns a value (e.g. axios response)
 * @param {Function} condition    (result) => boolean — return true to stop polling
 * @param {number}   interval     Poll interval in ms (default 3000)
 * @param {number}   maxDuration  Give up after this many ms (default 600000 = 10 min)
 */
export const usePolling = (pollFn, condition, interval = 3000, maxDuration = 600000) => {
  const [isPolling, setIsPolling]   = useState(false)
  const [data, setData]             = useState(null)
  const [error, setError]           = useState(null)
  const [completed, setCompleted]   = useState(false)
  const [progress, setProgress]     = useState(0)
  const intervalRef                 = useRef(null)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  const startPolling = useCallback(async () => {
    // Reset state
    setIsPolling(true)
    setError(null)
    setCompleted(false)
    setProgress(0)
    setData(null)

    const startTime = Date.now()

    intervalRef.current = setInterval(async () => {
      try {
        const result = await pollFn()
        setData(result)

        const elapsed = Date.now() - startTime
        setProgress(Math.min((elapsed / maxDuration) * 100, 95))

        if (condition(result)) {
          setCompleted(true)
          setProgress(100)
          stopPolling()
          return
        }

        if (elapsed > maxDuration) {
          setError('Analysis is taking longer than expected. Please check back later.')
          stopPolling()
        }
      } catch (err) {
        setError(err.message || 'Polling error')
        stopPolling()
      }
    }, interval)

    return stopPolling
  }, [pollFn, condition, interval, maxDuration, stopPolling])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { isPolling, data, error, completed, progress, startPolling, stopPolling }
}
