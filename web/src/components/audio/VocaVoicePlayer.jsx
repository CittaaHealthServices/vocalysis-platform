/**
 * VocaVoicePlayer — AI-powered wellness voice feedback using ElevenLabs.
 *
 * Fetches a personalized audio message from the backend (/audio/wellness-voice),
 * decodes the base64 audio, and lets the user play it inline.
 */
import { useState, useRef, useEffect } from 'react'
import api from '../../services/api'
import { Mic2, Play, Pause, Volume2, Loader2, AlertCircle, Sparkles } from 'lucide-react'

const WAVE_BARS = 20

/**
 * Animated waveform — shows while audio is playing.
 */
function AnimatedWave({ isPlaying }) {
  return (
    <div className="flex items-end gap-0.5 h-8">
      {Array.from({ length: WAVE_BARS }).map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all"
          style={{
            background: 'linear-gradient(to top, #7c3aed, #a78bfa)',
            height: isPlaying ? `${20 + Math.sin(i * 0.8) * 15}px` : '4px',
            animation: isPlaying ? `wave ${0.6 + (i % 5) * 0.08}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 0.04}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          from { transform: scaleY(1); }
          to   { transform: scaleY(1.8); }
        }
      `}</style>
    </div>
  )
}

export function VocaVoicePlayer({
  firstName,
  wellnessScore,
  riskLevel,
  mood,
  streakDays,
  autoLoad = false,
  compact = false,
}) {
  const [status, setStatus]     = useState('idle')   // idle | loading | ready | playing | paused | error
  const [script, setScript]     = useState('')
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const audioRef = useRef(null)

  // Auto-load if requested (e.g. after assessment completion)
  useEffect(() => {
    if (autoLoad) fetchVoice()
  }, [autoLoad]) // eslint-disable-line

  async function fetchVoice() {
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await api.post('/audio/wellness-voice', {
        firstName,
        wellnessScore,
        riskLevel,
        mood,
        streakDays,
      })

      const { audioBase64, mimeType, script: text } = res.data || res

      if (!audioBase64) throw new Error('No audio returned')

      // Decode base64 → Blob → Object URL
      const binary = atob(audioBase64)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob   = new Blob([bytes], { type: mimeType || 'audio/mpeg' })
      const url    = URL.createObjectURL(blob)

      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.load()
      }

      setScript(text || '')
      setStatus('ready')
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Voice generation failed'
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  function handlePlay() {
    if (!audioRef.current) return
    audioRef.current.play()
    setStatus('playing')
  }

  function handlePause() {
    if (!audioRef.current) return
    audioRef.current.pause()
    setStatus('paused')
  }

  function handleEnded() {
    setStatus('ready')
    setProgress(0)
  }

  function handleTimeUpdate() {
    if (!audioRef.current) return
    const { currentTime, duration: dur } = audioRef.current
    if (dur > 0) setProgress((currentTime / dur) * 100)
  }

  function handleLoadedMetadata() {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }

  function handleSeek(e) {
    if (!audioRef.current || !audioRef.current.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct  = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * audioRef.current.duration
  }

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <audio
          ref={audioRef}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />

        {status === 'idle' && (
          <button
            onClick={fetchVoice}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-sm font-medium transition-colors"
          >
            <Mic2 className="w-3.5 h-3.5" />
            Hear from Voca
          </button>
        )}

        {status === 'loading' && (
          <span className="flex items-center gap-2 text-violet-600 text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating…
          </span>
        )}

        {(status === 'ready' || status === 'paused') && (
          <button onClick={handlePlay} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
            <Play className="w-3.5 h-3.5" /> Play Voca
          </button>
        )}

        {status === 'playing' && (
          <button onClick={handlePause} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
            <Pause className="w-3.5 h-3.5" /> Pause
          </button>
        )}

        {status === 'error' && (
          <span className="text-red-500 text-sm flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Unavailable
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-5 space-y-4">
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
            <Mic2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-violet-900 flex items-center gap-1">
              Voca Voice™
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </p>
            <p className="text-xs text-violet-500">Your AI wellness companion</p>
          </div>
        </div>
        <Volume2 className="w-4 h-4 text-violet-300" />
      </div>

      {/* States */}
      {status === 'idle' && (
        <div className="text-center py-3 space-y-3">
          <p className="text-sm text-violet-700">
            Let Voca read your wellness insights to you — a warm, personalised voice message just for you.
          </p>
          <button
            onClick={fetchVoice}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Mic2 className="w-4 h-4" />
            Generate My Voca Message
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center py-4 gap-3">
          <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
          <p className="text-sm text-violet-600 text-center">
            Voca is crafting your personalised message…
          </p>
          <div className="flex gap-1">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center py-3 gap-2 text-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
          <p className="text-sm text-red-600">
            {errorMsg.includes('not configured')
              ? 'Voice service is not yet enabled. Ask your administrator to configure ElevenLabs.'
              : 'Could not generate your message. Please try again.'}
          </p>
          <button onClick={fetchVoice} className="text-xs text-violet-600 underline">Try again</button>
        </div>
      )}

      {(status === 'ready' || status === 'playing' || status === 'paused') && (
        <div className="space-y-3">
          {/* Script preview */}
          {script && (
            <p className="text-xs text-violet-700 italic line-clamp-3 leading-relaxed">
              "{script}"
            </p>
          )}

          {/* Waveform */}
          <div className="flex justify-center py-1">
            <AnimatedWave isPlaying={status === 'playing'} />
          </div>

          {/* Seek bar */}
          <div
            className="w-full h-1.5 bg-violet-100 rounded-full cursor-pointer overflow-hidden"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time display */}
          {duration > 0 && (
            <div className="flex justify-between text-xs text-violet-400">
              <span>{fmtTime((progress / 100) * duration)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-3">
            {status === 'playing' ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Pause className="w-4 h-4" /> Pause
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Play className="w-4 h-4" /> {status === 'paused' ? 'Resume' : 'Play'}
              </button>
            )}
            <button
              onClick={fetchVoice}
              className="px-4 py-2 border border-violet-200 text-violet-600 text-sm rounded-xl hover:bg-violet-50 transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default VocaVoicePlayer
