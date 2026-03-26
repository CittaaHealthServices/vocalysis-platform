import { useNavigate } from 'react-router-dom'
import { Menu, Bell, LogOut, User, Settings, AlertTriangle, X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'

/* Role-based profile and settings destinations */
const PROFILE_ROUTES = {
  EMPLOYEE:              '/my/profile',
  COMPANY_ADMIN:         '/company/settings',
  HR_ADMIN:              null,
  SENIOR_CLINICIAN:      null,
  CLINICAL_PSYCHOLOGIST: null,
  EAP_PROVIDER:          null,
  CITTAA_SUPER_ADMIN:    '/cittaa-admin',
  CITTAA_CEO:            '/ceo',
}

const SETTINGS_ROUTES = {
  EMPLOYEE:              '/my/profile',
  COMPANY_ADMIN:         '/company/settings',
  HR_ADMIN:              null,
  SENIOR_CLINICIAN:      null,
  CLINICAL_PSYCHOLOGIST: null,
  EAP_PROVIDER:          null,
  CITTAA_SUPER_ADMIN:    '/cittaa-admin/api-keys',
  CITTAA_CEO:            null,
}

/* Map alert severity / type → notification type icon */
function alertToNotif(alert, index) {
  const typeMap = { high: 'alert', medium: 'alert', low: 'info', success: 'success' }
  const type = typeMap[alert.severity] || 'info'
  const createdAt = alert.createdAt ? new Date(alert.createdAt) : null
  let time = ''
  if (createdAt) {
    const diff = Math.floor((Date.now() - createdAt.getTime()) / 1000)
    if (diff < 60)        time = `${diff}s ago`
    else if (diff < 3600) time = `${Math.floor(diff / 60)} min ago`
    else if (diff < 86400) time = `${Math.floor(diff / 3600)} hr ago`
    else                  time = createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  return {
    id:    alert._id || alert.id || index,
    type,
    title: alert.title || alert.message || 'Alert',
    body:  alert.description || alert.body || '',
    time,
    read:  alert.status === 'resolved' || alert.read || false,
  }
}

function NotifIcon({ type }) {
  if (type === 'alert')   return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
  if (type === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
  return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
}

export const TopNav = ({ onMenuClick, userImpersonating = false }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [dropdownOpen, setDropdownOpen]   = useState(false)
  const [notifOpen, setNotifOpen]         = useState(false)
  const [notifs, setNotifs]               = useState([])

  const dropdownRef = useRef(null)
  const notifRef    = useRef(null)

  /* Fetch real notifications from the API, scoped by role/tenant via auth cookie */
  useEffect(() => {
    if (!user) return
    api.get('/alerts?limit=15&status=active')
      .then(res => {
        const raw = res?.data?.data || res?.data?.alerts || res?.data || []
        if (Array.isArray(raw) && raw.length > 0) {
          setNotifs(raw.map((a, i) => alertToNotif(a, i)))
        }
      })
      .catch(() => { /* silently keep empty if API unavailable */ })
  }, [user])

  /* Close panels on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
      if (notifRef.current    && !notifRef.current.contains(e.target))    setNotifOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount  = notifs.filter(n => !n.read).length
  const profileRoute = PROFILE_ROUTES[user?.role]
  const settingsRoute= SETTINGS_ROUTES[user?.role]

  const displayName  = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.name || user?.email || 'User'
  const initials     = displayName.charAt(0).toUpperCase()

  const handleMarkAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })))
  const handleMarkRead    = (id) => setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x))

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3">

        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <span className="text-lg font-bold text-gray-900 hidden md:block"
                style={{ fontFamily: "'Kaushan Script', cursive" }}>
            Vocalysis
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">

          {/* Impersonation banner */}
          {userImpersonating && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg mr-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-xs text-red-700 font-semibold">Impersonating User</span>
            </div>
          )}

          {/* ── Notifications bell ── */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(o => !o); setDropdownOpen(false) }}
              className="relative p-2 hover:bg-gray-100 rounded-xl transition"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications panel */}
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="font-semibold text-gray-900 text-sm">Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-violet-600 font-semibold hover:text-violet-700"
                      >
                        Mark all read
                      </button>
                    )}
                    <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {notifs.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-8">No notifications</p>
                  ) : notifs.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkRead(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${!n.read ? 'bg-violet-50/40' : ''}`}
                    >
                      <NotifIcon type={n.type} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold text-gray-800 truncate ${!n.read ? 'text-gray-900' : ''}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{n.time}</p>
                      </div>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 px-4 py-2.5 text-center">
                  <button className="text-xs text-violet-600 font-semibold hover:text-violet-700">
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── User dropdown ── */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => { setDropdownOpen(o => !o); setNotifOpen(false) }}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 rounded-xl transition"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {initials}
              </div>
              <span className="text-sm font-semibold text-gray-800 hidden sm:block max-w-[120px] truncate">
                {displayName}
              </span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>

                {/* Profile */}
                {profileRoute && (
                  <button
                    onClick={() => { navigate(profileRoute); setDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    My Profile
                  </button>
                )}

                {/* Settings */}
                {settingsRoute && (
                  <button
                    onClick={() => { navigate(settingsRoute); setDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    Settings
                  </button>
                )}

                <div className="border-t border-gray-100" />

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopNav
