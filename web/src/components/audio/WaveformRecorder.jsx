import { useState, useRef, useEffect } from 'react'
import { Mic, Square, RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import WaveSurfer from 'wavesurfer.js'

export const WaveformRecorder = ({ onRecordingComplete, minDuration = 60, maxDuration = 480 }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [quality, setQuality] = useState('good')
  const [message, setMessage] = useState('')

  const mediaRecorderRef = useRef(null)
  const wavesurferRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)
  const durationIntervalRef = useRef(null)
  const animationFrameRef = useRef(null)

  useEffect(() => {
    // Initialize wavesurfer
    if (!wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#E5E3F0',
        progressColor: '#6B21A8',
        height: 100,
        barWidth: 2,
      })
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Setup audio analysis
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Setup media recorder
      mediaRecorderRef.current = new MediaRecorder(stream)
      const chunks = []

      mediaRecorderRef.current.ondataavailable = (e) => {
        chunks.push(e.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' })
        setRecordedBlob(blob)
        onRecordingComplete?.(blob)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setDuration(0)
      setMessage('Recording started. Please speak naturally...')

      // Monitor audio levels
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel((avg / 255) * 100)

          if (avg < 10) {
            setQuality('too-quiet')
          } else if (avg > 240) {
            setQuality('too-loud')
          } else {
            setQuality('good')
          }
        }
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
      updateAudioLevel()

      // Track duration
      durationIntervalRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch (error) {
      setMessage('Microphone access denied. Please allow microphone permissions.')
      console.error('Microphone error:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      if (duration < minDuration) {
        setMessage(`Recording too short. Minimum ${minDuration} seconds required.`)
      } else {
        setMessage('Recording complete!')
      }
    }
  }

  const resetRecording = () => {
    setRecordedBlob(null)
    setDuration(0)
    setAudioLevel(0)
    setQuality('good')
    setMessage('')
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getQualityColor = () => {
    switch (quality) {
      case 'too-quiet':
        return 'bg-yellow-500'
      case 'too-loud':
        return 'bg-red-500'
      default:
        return 'bg-green-500'
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-8">
      {/* Waveform Display */}
      <div
        id="waveform"
        className="mb-8 rounded-lg border border-gray-200 overflow-hidden"
      />

      {/* Duration Display */}
      <div className="text-center mb-6">
        <p className="text-4xl font-bold text-cittaa-700 font-mono">
          {formatDuration(duration)}
        </p>
        <p className="text-sm text-gray-600 mt-2">
          {duration < minDuration ? `${minDuration - duration}s to minimum` : 'Recording time'}
        </p>
      </div>

      {/* Quality Indicator */}
      {isRecording && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-app">Audio Quality</span>
            <span className="text-sm text-gray-600">
              {quality === 'good'
                ? 'Good'
                : quality === 'too-quiet'
                  ? 'Too Quiet'
                  : 'Too Loud'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${getQualityColor()} transition-all`}
              style={{ width: `${Math.min(audioLevel, 100)}%` }}
            />
          </div>
          {quality === 'too-quiet' && (
            <p className="text-xs text-yellow-600 mt-2">Please speak louder</p>
          )}
          {quality === 'too-loud' && (
            <p className="text-xs text-red-600 mt-2">Please speak more softly</p>
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className="mb-6 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-700">{message}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-4 justify-center">
        {!isRecording && !recordedBlob && (
          <Button onClick={startRecording} variant="primary" size="lg" className="gap-2">
            <Mic className="w-5 h-5" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <Button onClick={stopRecording} variant="danger" size="lg" className="gap-2">
            <Square className="w-5 h-5" />
            Stop Recording
          </Button>
        )}

        {recordedBlob && (
          <Button onClick={resetRecording} variant="secondary" size="lg" className="gap-2">
            <RotateCcw className="w-5 h-5" />
            Reset Recording
          </Button>
        )}
      </div>

      {/* Privacy Notice */}
      <p className="text-xs text-gray-500 mt-6 text-center">
        Your recording is private and will not be stored after analysis is complete.
      </p>
    </div>
  )
}

export default WaveformRecorder
