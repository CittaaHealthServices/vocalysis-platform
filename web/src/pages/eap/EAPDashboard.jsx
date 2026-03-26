import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import {
  CalendarDays, Users, Video, BookOpen, CheckCircle2, Clock,
  HeartPulse, Bell, ArrowRight, MessageCircle, Award, TrendingUp
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

/* ─────────────────────────────────────────────── */

function StatBadge({ value, label, icon: Icon, color = '#7c3aed' }) {
  return (
    <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: `${color}15` }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  )
}

function WebinarCard({ webinar, onRsvp }) {
  const isUpcoming = new Date(webinar.date) > new Date()
  const spotsLeft  = webinar.capacity - webinar.rsvpCount

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-2
            ${isUpcoming ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
            {isUpcoming ? 'Upcoming' : 'Completed'}
          </span>
          <h4 className="font-semibold text-gray-900 leading-tight">{webinar.title}</h4>
        </div>
        {webinar.rsvpd && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex-shrink-0">
            <CheckCircle2 className="w-3 h-3" /> RSVP'd
          </span>
        )}
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarDays className="w-4 h-4 flex-shrink-0" />
          {new Date(webinar.date).toLocaleString('en-IN', {
            dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
          })} IST
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4 flex-shrink-0" /> {webinar.durationMins} min
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4 flex-shrink-0" />
          {webinar.rsvpCount} registered · {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
        </div>
      </div>

      <p className="text-sm text-gray-500 leading-relaxed mb-4">{webinar.description}</p>

      <div className="flex flex-wrap gap-2">
        {webinar.tags?.map(t => (
          <span key={t} className="text-xs text-violet-700 bg-violet-50 px-2 py-1 rounded-lg font-medium">{t}</span>
        ))}
      </div>

      {isUpcoming && !webinar.rsvpd && spotsLeft > 0 && (
        <button
          onClick={() => onRsvp(webinar.id)}
          className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
        >
          RSVP · Reserve My Spot
        </button>
      )}
      {isUpcoming && webinar.rsvpd && (
        <button className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200">
          <span className="flex items-center justify-center gap-2">
            <Video className="w-4 h-4" /> Join Session
          </span>
        </button>
      )}
    </div>
  )
}

function ConsultationRow({ consult }) {
  const statusColor = {
    scheduled:  { bg: '#eff6ff', text: '#1d4ed8' },
    completed:  { bg: '#f0fdf4', text: '#16a34a' },
    cancelled:  { bg: '#fff1f2', text: '#dc2626' },
    pending:    { bg: '#fffbeb', text: '#b45309' },
  }
  const c = statusColor[consult.status] || statusColor.pending

  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-gray-50 last:border-0">
      <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700 flex-shrink-0">
        {consult.employeeName?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{consult.employeeName || 'Anonymous'}</p>
        <p className="text-xs text-gray-400">{consult.companyName}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-medium text-gray-700">
          {new Date(consult.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </p>
        <p className="text-xs text-gray-400">
          {new Date(consult.scheduledAt).toLocaleTimeString('en-IN', { timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
        </p>
      </div>
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: c.bg, color: c.text }}>
        {consult.status}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────── */

// Mock data for initial render
const MOCK_WEBINARS = [
  {
    id: 'w1',
    title: 'Managing Workplace Stress: Evidence-Based Strategies',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    durationMins: 60,
    capacity: 100,
    rsvpCount: 67,
    rsvpd: false,
    description: 'Learn practical, science-backed techniques for reducing occupational stress and building resilience in high-pressure environments.',
    tags: ['Stress', 'Resilience', 'Mindfulness'],
  },
  {
    id: 'w2',
    title: 'Understanding Burnout: Early Signs & Recovery Pathways',
    date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    durationMins: 45,
    capacity: 80,
    rsvpCount: 23,
    rsvpd: true,
    description: 'A deep-dive into the three dimensions of burnout (exhaustion, cynicism, inefficacy) and how to address them early.',
    tags: ['Burnout', 'Recovery', 'Mental Health'],
  },
  {
    id: 'w3',
    title: 'Sleep, Performance & Emotional Regulation',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    durationMins: 50,
    capacity: 60,
    rsvpCount: 58,
    rsvpd: true,
    description: 'Exploring the critical link between sleep quality, emotional regulation and workplace performance.',
    tags: ['Sleep', 'Performance', 'Wellbeing'],
  },
]

const MOCK_CONSULTATIONS = [
  { employeeName: 'Priya S.',   companyName: 'TechCorp India',   scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), status: 'scheduled' },
  { employeeName: 'Rahul M.',   companyName: 'GlobalBank',       scheduledAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), status: 'scheduled' },
  { employeeName: 'Anjali K.',  companyName: 'MedLife Hospital', scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), status: 'completed' },
  { employeeName: 'Vikram D.',  companyName: 'TechCorp India',   scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), status: 'pending' },
]

const UTILISATION_DATA = [
  { week: 'W1', sessions: 8,  webinars: 45 },
  { week: 'W2', sessions: 12, webinars: 67 },
  { week: 'W3', sessions: 9,  webinars: 52 },
  { week: 'W4', sessions: 15, webinars: 89 },
]

/* ─────────────────────────────────────────────── */

export const EAPDashboard = () => {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [rsvpdWebinars, setRsvpdWebinars] = useState(new Set(['w2', 'w3']))

  const { data: dashData, isLoading } = useApi(
    ['eap', 'dashboard'],
    () => api.get('/eap/dashboard').catch(() => null)
  )

  const webinars     = dashData?.webinars     || MOCK_WEBINARS
  const consultations = dashData?.consultations || MOCK_CONSULTATIONS

  const handleRsvp = (id) => {
    setRsvpdWebinars(prev => new Set([...prev, id]))
    // In production: api.post(`/eap/webinars/${id}/rsvp`)
  }

  const enrichedWebinars = webinars.map(w => ({
    ...w,
    rsvpd: rsvpdWebinars.has(w.id) || w.rsvpd,
  }))

  const TABS = [
    { id: 'overview',      label: 'Overview'      },
    { id: 'webinars',      label: 'Webinars'      },
    { id: 'consultations', label: 'Consultations' },
    { id: 'resources',     label: 'Resources'     },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          EAP Provider Hub
        </h1>
        <p className="text-gray-500">Manage sessions, webinars, and programme analytics</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${activeTab === t.id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ───────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBadge value={14}    label="Sessions This Week"    icon={CalendarDays} color="#7c3aed" />
            <StatBadge value={3}     label="Upcoming Webinars"     icon={Video}        color="#0ea5e9" />
            <StatBadge value={156}   label="Programme Participants" icon={Users}        color="#10b981" />
            <StatBadge value="4.8★"  label="Avg Session Rating"    icon={Award}        color="#f59e0b" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Utilisation chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-5">Programme Utilisation</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={UTILISATION_DATA} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="sessions"  name="1:1 Sessions"     fill="#7c3aed" radius={[4,4,0,0]} />
                  <Bar dataKey="webinars"  name="Webinar Attendees" fill="#a78bfa" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Today's schedule */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Today's Sessions</h3>
              <div className="space-y-3">
                {consultations.filter(c => c.status === 'scheduled').slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-violet-200 flex items-center justify-center text-xs font-bold text-violet-800 flex-shrink-0">
                      {c.employeeName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{c.employeeName}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(c.scheduledAt).toLocaleTimeString('en-IN', { timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST
                      </p>
                    </div>
                  </div>
                ))}
                {consultations.filter(c => c.status === 'scheduled').length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No sessions scheduled today</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Create Webinar',     icon: Video,        tab: 'webinars',      color: '#7c3aed' },
              { label: 'View All Sessions',  icon: CalendarDays, tab: 'consultations', color: '#0ea5e9' },
              { label: 'Resource Library',   icon: BookOpen,     tab: 'resources',     color: '#10b981' },
              { label: 'Send Announcement',  icon: Bell,         tab: 'overview',      color: '#f59e0b' },
            ].map(a => (
              <button key={a.label} onClick={() => setActiveTab(a.tab)}
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow text-left group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: `${a.color}15` }}>
                  <a.icon className="w-5 h-5" style={{ color: a.color }} />
                </div>
                <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── WEBINARS ───────────────────────────────────────────────────── */}
      {activeTab === 'webinars' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Webinars & Group Sessions</h2>
              <p className="text-sm text-gray-400 mt-0.5">Schedule group wellness programmes and manage RSVPs</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              <Video className="w-4 h-4" /> Create Webinar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {enrichedWebinars.map(w => (
              <WebinarCard key={w.id} webinar={w} onRsvp={handleRsvp} />
            ))}
          </div>
        </div>
      )}

      {/* ── CONSULTATIONS ──────────────────────────────────────────────── */}
      {activeTab === 'consultations' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">1:1 Counselling Sessions</h2>
              <p className="text-sm text-gray-400 mt-0.5">Individual EAP consultations with referred employees</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              <CalendarDays className="w-4 h-4" /> Schedule Session
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            {consultations.map((c, i) => <ConsultationRow key={i} consult={c} />)}
          </div>
        </div>
      )}

      {/* ── RESOURCES ──────────────────────────────────────────────────── */}
      {activeTab === 'resources' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Resource Library</h2>
            <p className="text-sm text-gray-400 mt-0.5">Share guides, worksheets and self-help materials with participants</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'Stress Management Toolkit',    type: 'PDF Guide',      downloads: 234, icon: '📘' },
              { title: 'Mindfulness Starter Pack',     type: 'Exercise Sheet', downloads: 189, icon: '🧘' },
              { title: 'Sleep Hygiene Checklist',      type: 'Worksheet',      downloads: 156, icon: '😴' },
              { title: 'Crisis Support Protocol',      type: 'Clinical Guide', downloads: 78,  icon: '🆘' },
              { title: 'CBT Self-Help Workbook',       type: 'Interactive',    downloads: 312, icon: '📓' },
              { title: 'Breathing Exercises Audio',    type: 'Audio Pack',     downloads: 267, icon: '🎧' },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="text-2xl flex-shrink-0">{r.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{r.title}</p>
                  <p className="text-xs text-gray-400">{r.type} · {r.downloads} downloads</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            ))}
          </div>

          <button className="flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700">
            <BookOpen className="w-4 h-4" /> Upload New Resource
          </button>
        </div>
      )}
    </div>
  )
}

export default EAPDashboard
