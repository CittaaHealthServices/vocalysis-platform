import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Square, RotateCcw, Volume2, VolumeX, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const MIN_DURATION = 30   // seconds
const MAX_DURATION = 120  // 2 minutes

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function fmtTime(s) {
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

/* ─── animated bars visualiser (no WaveSurfer, no extra deps) ─────────────── */
function AudioBars({ analyser, isRecording, barCount = 48 }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    const canvas  = canvasRef.current
    if (!canvas) return
    const ctx     = canvas.getContext('2d')
    const W       = canvas.width
    const H       = canvas.height
    const barW    = W / barCount - 1

    // idle ripple when not recording
    let frame = 0

    function draw() {
      ctx.clearRect(0, 0, W, H)
      const barHeights = new Array(barCount)

      if (isRecording && analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const step = Math.floor(data.length / barCount)
        for (let i = 0; i < barCount; i++) {
          barHeights[i] = (data[i * step] / 255) * (H * 0.9)
        }
      } else {
        // gentle idle wave
        for (let i = 0; i < barCount; i++) {
          const t = Date.now() / 1200
          barHeights[i] = (Math.sin(i * 0.35 + t) * 0.5 + 0.5) * H * 0.25 + 2
        }
      }

      barHeights.forEach((h, i) => {
        const x = i * (barW + 1)
        const y = (H - h) / 2
        const alpha = isRecording ? Math.max(0.4, h / (H * 0.9)) : 0.35
        ctx.fillStyle = isRecording
          ? `rgba(167,139,250,${alpha})`   // violet-400
          : `rgba(139,92,246,0.25)`        // muted idle
        ctx.beginPath()
        const r = Math.min(barW / 2, 3)
        ctx.roundRect(x, y, barW, h, r)
        ctx.fill()
      })

      frame++
      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [isRecording, analyser, barCount])

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={80}
      className="w-full"
      style={{ display: 'block' }}
    />
  )
}

/* ─── circular progress ring ───────────────────────────────────────────────── */
function TimeRing({ elapsed, min, max }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const progress = Math.min(elapsed / max, 1)
  const dash     = circ * progress
  const minFrac  = min / max
  const minDash  = circ * minFrac

  const pct = Math.round(progress * 100)
  const color = elapsed < min
    ? '#a78bfa'    // violet-400 — building up
    : elapsed < max * 0.85
      ? '#8b5cf6'  // violet-500 — good zone
      : '#ef4444'  // red — nearly at limit

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
      {/* track */}
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      {/* min threshold marker */}
      <circle cx="60" cy="60" r={r} fill="none"
        stroke="#6d28d9" strokeWidth="8"
        strokeDasharray={`${minDash} ${circ - minDash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* progress */}
      <circle cx="60" cy="60" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
      />
      {/* time text */}
      <text x="60" y="56" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', fill: '#fff' }}>
        {fmtTime(elapsed)}
      </text>
      <text x="60" y="74" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.5)', fontFamily: 'sans-serif' }}>
        {elapsed < min ? `${min - elapsed}s to min` : 'recording'}
      </text>
    </svg>
  )
}

/* ─── main component ────────────────────────────────────────────────────────── */
export function WaveformRecorder({ onRecordingComplete, minDuration = MIN_DURATION, maxDuration = MAX_DURATION }) {
  const [phase, setPhase]           = useState('idle')   // idle | recording | done | error
  const [elapsed, setElapsed]       = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [blob, setBlob]             = useState(null)
  const [permError, setPermError]   = useState(false)

  const mediaRecorderRef = useRef(null)
  const analyserRef      = useRef(null)
  const streamRef        = useRef(null)
  const chunksRef        = useRef([])
  const timerRef         = useRef(null)
  const rafRef           = useRef(null)

  /* cleanup */
  const cleanup = useCallback(() => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  /* auto-stop at maxDuration */
  useEffect(() => {
    if (elapsed >= maxDuration && phase === 'recording') {
      stopRecording()
    }
  }, [elapsed, phase, maxDuration])

  const startRecording = async () => {
    setPermError(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      streamRef.current = stream

      const ctx      = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      analyserRef.current = analyser

      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: 'audio/webm' })
        setBlob(recorded)
        setPhase('done')
        onRecordingComplete?.(recorded)
      }

      mr.start(250)
      setElapsed(0)
      setPhase('recording')

      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000)

      const trackLevel = () => {
        if (analyserRef.current) {
          const d = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(d)
          const avg = d.reduce((a, b) => a + b, 0) / d.length
          setAudioLevel(avg)
        }
        rafRef.current = requestAnimationFrame(trackLevel)
      }
      trackLevel()
    } catch (err) {
      console.error('Mic error', err)
      setPermError(true)
    }
  }

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    cleanup()
  }, [cleanup])

  const reset = () => {
    setBlob(null)
    setElapsed(0)
    setAudioLevel(0)
    setPhase('idle')
    setPermError(false)
  }

  /* quality indicator */
  const tooQuiet = phase === 'recording' && audioLevel < 8
  const tooLoud  = phase === 'recording' && audioLevel > 230
  const goodLevel = phase === 'recording' && !tooQuiet && !tooLoud
  const canStop  = elapsed >= minDuration

  return (
    <div className="space-y-4">

      {/* ── Notification banner ──────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 flex gap-3"
          >
            <Info className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-900">Voice recording required</p>
              <p className="text-sm text-violet-700 mt-0.5">
                Speak naturally for <strong>at least 30 seconds</strong> (up to 2 minutes).
                Your voice is analysed for wellness insights — no text is transcribed.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main recorder card ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1e1040 0%, #14082d 100%)', border: '1px solid rgba(139,92,246,0.25)' }}
      >
        {/* waveform area */}
        <div className="px-6 pt-6 pb-2">
          <AudioBars analyser={analyserRef.current} isRecording={phase === 'recording'} />
        </div>

        {/* controls row */}
        <div className="flex items-center gap-6 px-6 pb-6 pt-2">

          {/* time ring */}
          <TimeRing elapsed={elapsed} min={minDuration} max={maxDuration} />

          {/* right side */}
          <div className="flex-1 space-y-4">

            {/* quality meter */}
            {phase === 'recording' && (
              <div>
                <div className="flex justify-between mb-1.5 text-xs">
                  <span className="text-white/50 font-medium">Audio level</span>
                  <span className={tooQuiet ? 'text-yellow-400' : tooLoud ? 'text-red-400' : 'text-green-400'}>
                    {tooQuiet ? 'Too quiet' : tooLoud ? 'Too loud' : 'Good'}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((audioLevel / 255) * 100, 100)}%`,
                      background: tooQuiet ? '#fbbf24' : tooLoud ? '#ef4444' : '#8b5cf6',
                    }}
                    animate={{ width: `${Math.min((audioLevel / 255) * 100, 100)}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </div>
            )}

            {/* status text */}
            <div className="text-xs text-white/40">
              {phase === 'idle'      && 'Press record and speak naturally'}
              {phase === 'recording' && (elapsed < minDuration
                ? `Keep going — ${minDuration - elapsed}s until you can stop`
                : 'You can stop anytime, or keep going up to 2 min')}
              {phase === 'done'      && `Recorded ${fmtTime(elapsed)} — ready to submit`}
            </div>

            {/* buttons */}
            <div className="flex gap-3">
              {phase === 'idle' && (
                <motion.button
                  onClick={startRecording}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                >
                  <Mic className="w-4 h-4" />
                  Start Recording
                </motion.button>
              )}

              {phase === 'recording' && (
                <motion.button
                  onClick={stopRecording}
                  disabled={!canStop}
                  whileHover={canStop ? { scale: 1.03 } : {}}
                  whileTap={canStop ? { scale: 0.97 } : {}}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
                  style={{
                    background: canStop
                      ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                      : 'rgba(255,255,255,0.12)',
                    opacity: canStop ? 1 : 0.5,
                    cursor: canStop ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Square className="w-4 h-4" />
                  {canStop ? 'Stop' : `${minDuration - elapsed}s…`}
                </motion.button>
              )}

              {phase === 'done' && (
                <motion.button
                  onClick={reset}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white/80"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Re-record
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* recording pulse indicator */}
        {phase === 'recording' && (
          <div className="px-6 pb-4 flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-xs text-white/40 font-medium">RECORDING · {fmtTime(elapsed)} / {fmtTime(maxDuration)}</span>
          </div>
        )}

        {/* done badge */}
        {phase === 'done' && (
          <div className="px-6 pb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400 font-medium">Recording complete ({fmtTime(elapsed)})</span>
          </div>
        )}
      </div>

      {/* permission error */}
      {permError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Microphone access denied</p>
            <p className="text-sm text-red-700 mt-0.5">
              Please allow microphone access in your browser settings and try again.
            </p>
          </div>
        </motion.div>
      )}

      {/* privacy notice */}
      <p className="text-xs text-gray-400 text-center">
        Your voice recording is processed securely and not stored after analysis.
      </p>
    </div>
  )
}

export default WaveformRecorder
