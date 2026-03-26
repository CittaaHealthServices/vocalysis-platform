import { useState, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import ConsultationBookingModal from '../../components/consultations/ConsultationBookingModal'
import ConsultationCard from '../../components/consultations/ConsultationCard'
import { ChevronLeft, ChevronRight, Calendar, List, Video, Clock, User } from 'lucide-react'
import api from '../../services/api'

// ── Helpers ──────────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM – 7 PM
const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfWeek(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate()
}

function fmt(date, opts) {
  return new Date(date).toLocaleString('en-IN', opts)
}

const STATUS_COLORS = {
  SCHEDULED: { bg: 'bg-blue-100',  border: 'border-blue-400',  text: 'text-blue-800'  },
  CONFIRMED: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
  PENDING:   { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800' },
  COMPLETED: { bg: 'bg-gray-100',  border: 'border-gray-300',  text: 'text-gray-500'  },
  CANCELLED: { bg: 'bg-red-50',    border: 'border-red-300',   text: 'text-red-500'   },
}

// ── Weekly Calendar ───────────────────────────────────────────────────────────
function WeekCalendar({ consultations }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  const weekDays = useMemo(() => (
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
  ), [weekStart])

  const prev  = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const next  = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  const today = () => setWeekStart(startOfWeek(new Date()))

  // Build slot map: "YYYY-M-D_H" → [consultations]
  const slotMap = useMemo(() => {
    const map = {}
    ;(consultations || []).forEach(c => {
      const dt = new Date(c.scheduledAt)
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}_${dt.getHours()}`
      if (!map[key]) map[key] = []
      map[key].push(c)
    })
    return map
  }, [consultations])

  const getSlot = (day, hour) =>
    slotMap[`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}_${hour}`] || []

  const todayDate = new Date()
  const weekLabel = `${fmt(weekDays[0], { month: 'short', day: 'numeric' })} – ${fmt(weekDays[6], { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[210px] text-center">{weekLabel}</span>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <button onClick={today}
          className="px-3 py-1.5 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition">
          Today
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className="w-14 border-b border-gray-100 bg-gray-50 py-3" />
              {weekDays.map((day, i) => {
                const isToday = sameDay(day, todayDate)
                return (
                  <th key={i} className="border-b border-l border-gray-100 bg-gray-50 py-3 px-2 text-center">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      {DAYS[day.getDay()]}
                    </div>
                    <div className={`text-base font-bold mt-0.5 mx-auto w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-violet-600 text-white' : 'text-gray-700'
                    }`}>
                      {day.getDate()}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour}>
                <td className="w-14 border-b border-gray-50 py-1 pr-2 text-right align-top">
                  <span className="text-[10px] text-gray-400 leading-none whitespace-nowrap">
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </td>
                {weekDays.map((day, di) => {
                  const slots  = getSlot(day, hour)
                  const isPast = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour + 1) < todayDate
                  return (
                    <td key={di}
                      style={{ minWidth: 80, height: 48 }}
                      className={`border-b border-l border-gray-50 p-0.5 align-top transition-colors ${
                        isPast ? 'bg-gray-50/60' : 'hover:bg-violet-50/20'
                      }`}
                    >
                      {slots.map((c, ci) => {
                        const col = STATUS_COLORS[c.status] || STATUS_COLORS.SCHEDULED
                        const dt  = new Date(c.scheduledAt)
                        return (
                          <div key={ci}
                            className={`rounded-md px-1.5 py-0.5 mb-0.5 border-l-2 text-[11px] cursor-pointer hover:opacity-75 transition select-none ${col.bg} ${col.border} ${col.text}`}
                            title={`${c.patient?.name || 'Patient'} — ${fmt(dt, { hour: 'numeric', minute: '2-digit' })}`}
                          >
                            <div className="font-semibold truncate leading-tight">
                              {c.patient?.name || c.clinician || 'Session'}
                            </div>
                            <div className="opacity-60 text-[9px]">
                              {fmt(dt, { hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 pt-1">
        <span className="font-medium text-gray-600 mr-1">Status:</span>
        {Object.entries(STATUS_COLORS).map(([s, col]) => (
          <span key={s} className={`px-2 py-0.5 rounded-full font-medium ${col.bg} ${col.text}`}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Upcoming sidebar ──────────────────────────────────────────────────────────
function UpcomingList({ consultations }) {
  const upcoming = useMemo(() => {
    const now = new Date()
    return (consultations || [])
      .filter(c => new Date(c.scheduledAt) >= now && c.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .slice(0, 8)
  }, [consultations])

  if (!upcoming.length) return (
    <p className="text-sm text-gray-400 text-center py-6">No upcoming sessions</p>
  )

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)

  return (
    <div className="space-y-2">
      {upcoming.map(c => {
        const dt  = new Date(c.scheduledAt)
        const col = STATUS_COLORS[c.status] || STATUS_COLORS.SCHEDULED
        const day = sameDay(dt, new Date()) ? 'Today'
          : sameDay(dt, tomorrow) ? 'Tomorrow'
          : fmt(dt, { weekday: 'short', month: 'short', day: 'numeric' })

        return (
          <div key={c.id || c._id}
            className={`flex items-start gap-2 p-2.5 rounded-xl border ${col.bg} border-opacity-60`}
            style={{ borderColor: 'transparent' }}
          >
            <div className={`text-center min-w-[48px] ${col.text}`}>
              <div className="text-[9px] font-bold uppercase opacity-70">{day}</div>
              <div className="text-xs font-bold">{fmt(dt, { hour: 'numeric', minute: '2-digit' })}</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate flex items-center gap-1">
                <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                {c.patient?.name || c.clinician || 'Patient'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> {c.durationMinutes || 50} min
                </span>
                {c.meetLink && (
                  <a href={c.meetLink} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5 hover:underline">
                    <Video className="w-2.5 h-2.5" /> Join
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const Consultations = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [viewMode, setViewMode]   = useState('calendar')

  const { data: consultations, isLoading, refetch } = useApi(
    ['consultations'],
    () => api.get('/consultations')
  )

  if (isLoading) return <LoadingScreen />

  const list = consultations?.data || []
  const now = new Date()
  const upcomingCount = list.filter(c => new Date(c.scheduledAt) >= now && c.status !== 'CANCELLED').length

  const thisWeekStart = startOfWeek(new Date())
  const thisWeekEnd   = new Date(thisWeekStart); thisWeekEnd.setDate(thisWeekStart.getDate() + 7)
  const thisWeek      = list.filter(c => { const d = new Date(c.scheduledAt); return d >= thisWeekStart && d < thisWeekEnd })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-app">Consultations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{upcomingCount} upcoming session{upcomingCount !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          + Book Consultation
        </Button>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['calendar', Calendar, 'Calendar'], ['list', List, 'List']].map(([mode, Icon, label]) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              viewMode === mode ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Calendar view ── */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-6">
          <Card className="p-5">
            <WeekCalendar consultations={list} />
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-violet-500" /> Upcoming Sessions
              </h3>
              <UpcomingList consultations={list} />
            </Card>

            <Card className="p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">This Week</h3>
              <div className="space-y-1.5">
                {[
                  ['Total',     thisWeek.length],
                  ['Confirmed', thisWeek.filter(c => c.status === 'CONFIRMED').length],
                  ['Pending',   thisWeek.filter(c => c.status === 'PENDING').length],
                  ['Completed', thisWeek.filter(c => c.status === 'COMPLETED').length],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-bold text-gray-800">{val}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── List view ── */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 gap-4">
          {list.length === 0 && (
            <Card className="p-12 text-center">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No consultations yet</p>
              <Button variant="primary" className="mt-4" onClick={() => setModalOpen(true)}>
                Book your first consultation
              </Button>
            </Card>
          )}
          {list.map((c) => (
            <ConsultationCard key={c.id || c._id} consultation={c} />
          ))}
        </div>
      )}

      <ConsultationBookingModal isOpen={modalOpen} onClose={() => { setModalOpen(false); refetch?.() }} />
    </div>
  )
}

export default Consultations
