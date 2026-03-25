import { useNavigate } from 'react-router-dom'
import { Menu, Bell, LogOut, User, Settings, AlertTriangle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'

export const TopNav = ({ onMenuClick, userImpersonating = false }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-semibold text-app hidden md:block">
            Vocalysis Platform
          </h1>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          {/* Impersonation Banner */}
          {userImpersonating && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700 font-medium">Impersonating User</span>
            </div>
          )}

          {/* Notifications */}
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition">
            <Bell className="w-6 h-6 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full" />
          </button>

          {/* User Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition"
            >
              <div className="w-8 h-8 rounded-full bg-cittaa-700 flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm font-medium text-app hidden sm:block">{user?.name}</span>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-app">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    navigate('/my/profile')
                    setDropdownOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-app hover:bg-gray-50 transition"
                >
                  <User className="w-4 h-4" />
                  My Profile
                </button>
                <button
                  onClick={() => {
                    navigate('/company/settings')
                    setDropdownOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-app hover:bg-gray-50 transition"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
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
